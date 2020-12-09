# Debugging your PlayFab ExecuteFunction calls locally

To debug your functions locally

- Install this package with `npm i playfab_execute_function`
- Create a folder at the root of your project called ExecuteFunction
- Add a file to your new folder called `settings.json` and add the following

```json
{
  "bindings": [
    {
      "authLevel": "function",
      "type": "httpTrigger",
      "route": "CloudScript/ExecuteFunction",
      "direction": "in",
      "name": "req",
      "methods": ["get", "post"]
    },
    {
      "type": "http",
      "direction": "out",
      "name": "res"
    }
  ],
  "scriptFile": "../dist/ExecuteFunction/index.js"
}
```

- Add a file to your ExecuteFunction folder called `index.ts` with the following code

```typescript
import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import ExecuteFunction from "playfab_execute_function";

const httpTrigger: AzureFunction = async (
  context: Context,
  req: HttpRequest
): Promise<void> => {
  ExecuteFunction(context, req);
};

export default httpTrigger;
```

- Add a playfab.local.settings file as described [here](https://docs.microsoft.com/en-us/gaming/playfab/features/automation/cloudscript-af/local-debugging-for-cloudscript-using-azure-functions#configure-playfab-sdk-to-call-local-executefunction-implementation)
