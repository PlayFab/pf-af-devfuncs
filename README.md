# pf-af-devfuncs
Azure Functions related to the PlayFab developer experience

This repository contains various Azure Functions that contribute to the PlayFab developer experience.
Specifically, various implementation of ExecuteFunction, which are used to support local debugging of 
Azure Functions when using CloudScript.

Setting up local debugging involves 2 broad steps;

* Adding an implementation of ExecuteFunction to your local Azure Functions app
* Adding a settings file to tell the PlayFab SDK to call that local implementation from your game.

Once those steps are complete, you can run your local Azure Functions app under 
the debugger (e.g. in VS Code or Visual Studio), set your breakpoints and run
your game client.

The rest of this document provides details on the above two steps.

# Local implementation of ExecuteFunction

## For C# Azure Functions apps

To get the local implementation of ExecuteFunction set up in your C# Azure Functions app, add the [ExecuteFunction.cs](https://github.com/PlayFab/pf-af-devfuncs/blob/master/csharp/ExecuteFunction.cs) file to your local Azure Functions app.

# Required environment variables for local implementation of ExecuteFunction

Next, add two settings to your local.settings.json file;

| Name | Value |
|--|--|
| PLAYFAB_TITLE_ID | Your title ID, in hex form |
| PLAYFAB_DEV_SECRET_KEY | Secret key for your title | 

For example;

```
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "...",
    "FUNCTIONS_WORKER_RUNTIME": "dotnet",
    "PLAYFAB_TITLE_ID": "B55D",
    "PLAYFAB_DEV_SECRET_KEY": "AAAABBBBCCCCDDDDEEEEFFFFGGGGHHHHIIIIJJJJKKKKLLLLMM"
  }
}

```

# Configuring PlayFab SDK to call local ExecuteFunction implementation

To tell the PlayFab SDK to redirect ExecuteFunction API calls to your local implementation, add a file called playfab.local.settings.json to one of two places;

* The temporary directory on your machine
  * TMPDIR environment variable on Linux/Mac
  * TEMP environment variable on Windows
* The directory of your game executable.  
  
The content of the file should be as follows;

```
{ "LocalApiServer": "http://localhost:7071/api/" }
```

To stop local redirects and make ExecuteFunction call the PlayFab API server simply delete the playfab.local.settings.json file.

The above is supported in the following SDKs;

* [PlayFab C# SDK](https://github.com/PlayFab/CSharpSDK)
* [PlayFab Unity SDK](https://github.com/PlayFab/UnitySDK)
* [Unreal 4 Marketplace PlugIn for PlayFab](https://github.com/PlayFab/UnrealMarketplacePlugin)