// A local implementation of the ExecuteFunction feature. Provides the ability to execute an Azure Function with a local URL with respect to the host
// of the application this function is running in.
// <param name="httpRequest">The HTTP request</param>
// <returns>The function execution result(s)</returns>
import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import axios from "axios";
import { gzip } from "node-gzip";
import { StopWatch } from "stopwatch-node";
import hostDotJson from "../host.json";

/* 
Types and Class definitions 
*/
class FunctionContextInternal {
  TitleAuthenticationContext: TitleAuthenticationContext;

  CallerEntityProfile: EntityProfile | undefined;

  FunctionArgument: JSON;

  constructor(
    TitleAuthenticationContext: TitleAuthenticationContext,
    CallerEntityProfile: EntityProfile | undefined,
    FunctionArgument: JSON
  ) {
    this.TitleAuthenticationContext = TitleAuthenticationContext;
    this.CallerEntityProfile = CallerEntityProfile;
    this.FunctionArgument = FunctionArgument;
  }
}

type TitleAuthenticationContext = {
  Id: string;
  EntityToken: string;
};

type EntityProfileResponse = {
  data: {
    Profile: EntityProfile;
  };
  code: number;
};

type EntityProfile = {
  Entity: Entity;
  Created: Date;
  EntityChain: string;
  Lineage: EntityLineage;
};

type Entity = {
  Id: string;
  Type: string;
  TypeString: string;
};

type EntityLineage = {
  MasterPlayerAccountId: string;
  NamespaceId: string;
  TitleId: string;
  TitlePlayerAccountId: string;
  VersionNumber: number;
};
/*

/*
Helper Functions
*/
const getRoutePrefix = () => {
  // Since host.json can omit properties it doesn't want to override, we might
  // not have all the properties, so we'll cast the json as `any` to avoid compiler
  // errors for sparsely populated host.json files
  const castHostJson: any = hostDotJson;
  const routePrefix: string | undefined =
    castHostJson.extensions?.http?.routePrefix;
  return routePrefix || "api";
};

const compressResponseBody = async (
  responseObject: object,
  req: HttpRequest
) => {
  const encodingsString = (req.headers["accept-encoding"] || "").toLowerCase();
  const responseBytes = Buffer.from(JSON.stringify(responseObject), "utf-8");
  const encodings: string[] = encodingsString
    ?.replace(/\s/g, "") // remove whitespace
    .split(",")
    .filter((str) => {
      // remove empty string character from array because ''.split results in ['']
      return /\S/.test(str);
    });

  // If client doesn't specify accepted encodings, assume identity and respond decompressed
  if (!encodings.length || encodings.includes("identity")) {
    return responseBytes;
  }

  if (encodings.length && !encodings.includes("gzip")) {
    throw new Error(
      `Unknown compression requested for response. The "Accept-Encoding" haeder values was: ${encodingsString}. Only "Identity" and "GZip" are supported right now.`
    );
  }

  // gzip returns a Buffer, which is a subclass of Uint8Array
  const gzpippedResponse = await gzip(responseBytes);
  return gzpippedResponse;
};

const getEntityProfile = async (
  callerEntityToken: string,
  entity: Entity | undefined
) => {
  try {
    const profileResponse = await axios.post<EntityProfileResponse>(
      "/Profile/GetProfile",
      {
        Entity: entity,
      },
      {
        baseURL: `https://${process.env.PLAYFAB_TITLE_ID}.playfabapi.com`,
        headers: {
          "Content-Type": "application/json",
          "X-EntityToken": callerEntityToken,
        },
      }
    );

    return profileResponse;
  } catch (error) {
    return Promise.reject(error);
  }
};

/*
Local implementation of ExecuteFunction
*/
const httpTrigger: AzureFunction = async (
  context: Context,
  req: HttpRequest
): Promise<void> => {
  const titleId = process.env.PLAYFAB_TITLE_ID!;
  if (typeof titleId !== "string") {
    throw new Error("Please set your TitleId in local.settings.json!");
  }

  // Extract the caller's entity tocken
  const callerEntityToken = req.headers["x-entitytoken"];

  const entityKey: Entity | undefined =
    req.body && req.body?.Entity
      ? {
          Id: req.body?.Entity?.Id,
          Type: req.body?.Entity?.Type,
          TypeString: req.body?.Entity?.Type,
        }
      : undefined;

  // Fetch the Profile From PlayFab
  const callerEntityProfileResponse = await getEntityProfile(
    callerEntityToken,
    entityKey
  );

  if (callerEntityProfileResponse.data.code !== 200) {
    context.res = {
      status: callerEntityProfileResponse.data.code,
      body: {},
    };
    return Promise.reject();
  }

  const callerEntityProfile = callerEntityProfileResponse.data.data.Profile;
  const functionContextInternal = new FunctionContextInternal(
    { Id: titleId, EntityToken: callerEntityToken },
    callerEntityProfile,
    req.body.FunctionParameter
  );

  const routePrefix = getRoutePrefix();

  const stopwatch = new StopWatch("stopwatch");
  stopwatch.start("AzureFunction");
  const response = await axios.post(
    `/${routePrefix}/${req.body.FunctionName}`,
    JSON.stringify(functionContextInternal),
    {
      baseURL: "http://localhost:7071",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
  stopwatch.stop();

  context.res = {
    status: response.status,
    body: await compressResponseBody(
      {
        code: response.status,
        status: response.statusText,
        data: {
          FunctionName: req.body.FunctionName,
          FunctionResult: response.data,
          ExecutionTimeMilliseconds: stopwatch.getTask("AzureFunction")
            ?.timeMills,
          FunctionResultTooLarge: false,
        },
      },
      req
    ),
  };
};

export default httpTrigger;
