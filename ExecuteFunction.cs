// Copyright (C) Microsoft Corporation. All rights reserved.

using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Extensions.Http;
using Microsoft.Extensions.Logging;
using PlayFab;
using PlayFab.Internal;
using PlayFab.Json;
using PlayFab.ProfilesModels;

namespace PlayFab.AzureFunctions
{
    public static class ExecuteFunction
    {
        private const string DEV_SECRET_KEY = "PLAYFAB_DEV_SECRET_KEY";
        private const string TITLE_ID = "PLAYFAB_TITLE_ID";
        private const string VERTICAL_NAME = "PLAYFAB_VERTICAL_NAME";

        /// <summary>
        /// A local implementation of the ExecuteFunction feature. Provides the ability to execute an Azure Function with a local URL with respect to the host
        /// of the application this function is running in.
        /// </summary>
        /// <param name="functionRequest">The execution request</param>
        /// <param name="httpRequest">The HTTP request</param>
        /// <param name="log">A logger object</param>
        /// <returns>The function execution result(s)</returns>
        [FunctionName("ExecuteFunction")]
        public static async Task<HttpResponseMessage> Run(
            [HttpTrigger(AuthorizationLevel.Function, "post", Route = "CloudScript/ExecuteFunction")] HttpRequest request, ILogger log)
        {
            // Extract the caller's entity token 
            string callerEntityToken = request.Headers["X-EntityToken"];

            // Extract the request body and deserialize
            StreamReader reader = new StreamReader(request.Body);
            string body = await reader.ReadToEndAsync();
            ExecuteFunctionRequest execRequest = PlayFabSimpleJson.DeserializeObject<ExecuteFunctionRequest>(body);

            var getProfileUrl = GetServerApiUri("/Profile/GetProfile");

            // Create the get entity profile request
            var profileRequest = new GetEntityProfileRequest { };

            // Prepare the request headers
            var profileRequestContent = new StringContent(PlayFabSimpleJson.SerializeObject(profileRequest));
            profileRequestContent.Headers.Add("X-EntityToken", callerEntityToken);
            profileRequestContent.Headers.ContentType = new MediaTypeHeaderValue("application/json");

            PlayFabJsonSuccess<GetEntityProfileResponse> getProfileResponseSuccess = null;
            GetEntityProfileResponse getProfileResponse = null;

            // Execute the get entity profile request
            using (var client = new HttpClient())
            {
                using (HttpResponseMessage profileResponseMessage =
                    await client.PostAsync(getProfileUrl, profileRequestContent))
                {
                    using (HttpContent profileResponseContent = profileResponseMessage.Content)
                    {
                        string profileResponseString = await profileResponseContent.ReadAsStringAsync();

                        // Deserialize the http response
                        getProfileResponseSuccess =
                            PlayFabSimpleJson.DeserializeObject<PlayFabJsonSuccess<GetEntityProfileResponse>>(profileResponseString);

                        // Extract the actual get profile response from the deserialized http response
                        getProfileResponse = getProfileResponseSuccess?.data;
                    }
                }
            }

            // If response object was not filled it means there was an error
            if (getProfileResponseSuccess?.data == null || getProfileResponseSuccess?.code != 200)
            {
                throw new Exception($"Failed to get Entity Profile: code: {getProfileResponseSuccess?.code}");
            }

            // FIND THE TITLE ENTITY TOKEN AND ATTACH TO REQUEST TO OUTBOUND TARGET FUNCTION
            string titleEntityToken = null;

            PlayFab.AuthenticationModels.GetEntityTokenRequest titleEntityTokenRequest = new PlayFab.AuthenticationModels.GetEntityTokenRequest();

            var getEntityTokenUrl = GetServerApiUri("/Authentication/GetEntityToken");

            var secretKey = Environment.GetEnvironmentVariable(DEV_SECRET_KEY, EnvironmentVariableTarget.Process);
            var titleEntityTokenRequestContent = new StringContent(PlayFabSimpleJson.SerializeObject(titleEntityTokenRequest));
            titleEntityTokenRequestContent.Headers.ContentType = new MediaTypeHeaderValue("application/json");
            titleEntityTokenRequestContent.Headers.Add("X-SecretKey", secretKey);

            PlayFabJsonSuccess<PlayFab.AuthenticationModels.GetEntityTokenResponse> titleEntityTokenResponseSuccess = null;
            PlayFab.AuthenticationModels.GetEntityTokenResponse titleEntityTokenResponse = null;

            using (var client = new HttpClient())
            {
                using (HttpResponseMessage titleEntityTokenResponseMessage =
                    await client.PostAsync(getEntityTokenUrl, titleEntityTokenRequestContent))
                {
                    using (HttpContent titleEntityTokenResponseContent = titleEntityTokenResponseMessage.Content)
                    {
                        string titleEntityTokenResponseString = await titleEntityTokenResponseContent.ReadAsStringAsync();

                        // Deserialize the http response
                        titleEntityTokenResponseSuccess =
                            PlayFabSimpleJson.DeserializeObject<PlayFabJsonSuccess<PlayFab.AuthenticationModels.GetEntityTokenResponse>>(titleEntityTokenResponseString);

                        // Extract the actual get title entity token header
                        titleEntityTokenResponse = titleEntityTokenResponseSuccess.data;
                        titleEntityToken = titleEntityTokenResponse.EntityToken;
                    }
                }
            }

            // Extract the request for the next stage from the get arguments response
            FunctionExecutionContextInternal functionExecutionContext = new FunctionExecutionContextInternal
            {
                EntityProfile = getProfileResponse.Profile,
                FunctionArgument = execRequest.FunctionParameter,
                TitleAuthenticationContext = new TitleAuthenticationContext
                {
                    Id = Environment.GetEnvironmentVariable(TITLE_ID, EnvironmentVariableTarget.Process),
                    SecretKey = secretKey,
                    EntityToken = titleEntityToken
                }
            };

            // Assemble the target function's path in the current App
            string routePrefix = GetHostRoutePrefix();
            string functionPath = routePrefix != null ? routePrefix + "/" + execRequest.FunctionName
                : execRequest.FunctionName;

            // Build URI of Azure Function based on current host
            var uriBuilder = new UriBuilder
            {
                Host = request.Host.Host,
                Port = request.Host.Port ?? 80,
                Path = functionPath
            };

            // Serialize the request to the azure function and add headers
            var functionRequestContent = new StringContent(PlayFabSimpleJson.SerializeObject(functionExecutionContext));
            functionRequestContent.Headers.ContentType = new MediaTypeHeaderValue("application/json");

            var sw = new Stopwatch();
            sw.Start();

            // Execute the local azure function
            using (var client = new HttpClient())
            {
                using (HttpResponseMessage functionResponseMessage =
                    await client.PostAsync(uriBuilder.Uri.AbsoluteUri, functionRequestContent))
                {
                    sw.Stop();
                    double executionTime = sw.ElapsedMilliseconds;

                    // Extract the response content
                    using (HttpContent functionResponseContent = functionResponseMessage.Content)
                    {
                        string functionResponseString = await functionResponseContent.ReadAsStringAsync();

                        // Prepare a response to reply back to client with and include function execution results
                        var functionResult = new ExecuteFunctionResult
                        {
                            FunctionName = execRequest.FunctionName,
                            FunctionResult = PlayFabSimpleJson.DeserializeObject(functionResponseString),
                            ExecutionTimeSeconds = executionTime,
                            FunctionResultTooLarge = false
                        };

                        // Reply back to client with final results
                        var output = new PlayFabJsonSuccess<ExecuteFunctionResult>
                        {
                            code = 200,
                            status = "OK",
                            data = functionResult
                        };
                        // Serialize the output and return it
                        var outputStr = PlayFabSimpleJson.SerializeObject(output);
                        return new HttpResponseMessage
                        {
                            Content = new StringContent(outputStr, Encoding.UTF8, "application/json"),
                            StatusCode = HttpStatusCode.OK
                        };
                    }
                }
            }
        }

        private static string GetServerApiUri(string endpoint)
        {
            var sb = new StringBuilder();

            // Append the title name if applicable
            string title = Environment.GetEnvironmentVariable(TITLE_ID, EnvironmentVariableTarget.Process);
            if (!string.IsNullOrEmpty(title))
            {
                sb.Append(title).Append(".");
            }
            // Append the vertical name if applicable
            string vertical = Environment.GetEnvironmentVariable(VERTICAL_NAME, EnvironmentVariableTarget.Process);
            if (!string.IsNullOrEmpty(vertical))
            {
                sb.Append(vertical).Append(".");
            }
            // Append base PF API address
            sb.Append("playfabapi.com");

            var uriBuilder = new UriBuilder
            {
                Scheme = "https",
                Host = sb.ToString(),
                Path = endpoint
            };

            return uriBuilder.Uri.AbsoluteUri;
        }

        private static string ReadAllFileText(string filename)
        {
            StringBuilder sb = new StringBuilder();

            if (!File.Exists(filename))
            {
                return string.Empty;
            }

            if (sb == null)
            {
                sb = new StringBuilder();
            }
            sb.Length = 0;

            using (var fs = new FileStream(filename, FileMode.Open))
            {
                using (var br = new BinaryReader(fs))
                {
                    while (br.BaseStream.Position != br.BaseStream.Length)
                    {
                        sb.Append(br.ReadChar());
                    }
                }
            }

            return sb.ToString();
        }

        private static string GetHostRoutePrefix()
        {
            string hostFileContent = null;
            string currDir = Directory.GetCurrentDirectory();
            string currDirHostFile = Path.Combine(currDir, "host.json");

            if (File.Exists(currDirHostFile))
            {
                hostFileContent = ReadAllFileText(currDirHostFile);
            }

            HostJsonModel hostModel = PlayFabSimpleJson.DeserializeObject<HostJsonModel>(hostFileContent);

            return hostModel?.extensions?.http?.routePrefix;
        }
    }

    public class TitleAuthenticationContext
    {
        public string Id;
        public string SecretKey;
        public string EntityToken;
    }

    public class FunctionExecutionContextInternal : FunctionExecutionContextInternal<object>
    {
    }

    public class FunctionExecutionContextInternal<T> : PlayFabRequestCommon
    {
        public TitleAuthenticationContext TitleAuthenticationContext { get; set; }
        public EntityProfileBody EntityProfile { get; set; }
        public T FunctionArgument { get; set; }
    }

    public class ExecuteFunctionRequest : PlayFabRequestCommon
    {
        public EntityKey Entity { get; set; }

        public string FunctionName { get; set; }

        public object FunctionParameter { get; set; }

        public bool? GeneratePlayStreamEvent { get; set; }
    }

    public class ExecuteFunctionResult : PlayFabResultCommon
    {
        public double ExecutionTimeSeconds;
        public string FunctionName;
        public object FunctionResult;
        public bool? FunctionResultTooLarge;
    }

    public class HostJsonModel
    {
        public string version { get; set; }
        public HostJsonExtensionsModel extensions { get; set; }

        public class HostJsonExtensionsModel
        {
            public HostJsonHttpModel http { get; set; }
        }

        public class HostJsonHttpModel
        {
            public string routePrefix { get; set; }
        }
    }
}
