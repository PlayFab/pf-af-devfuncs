import axios from 'axios';
import { gzip, ungzip } from 'node-gzip';
import functionToTest from './index';

const { runStubFunctionFromBindings, createHttpTrigger } = require('stub-azure-function-context');

// Mock response when fetching Profile from PlayFab
const mockProfileSuccessResponse = {
  status: 200,
  statusText: 'OK',
  data: {
    code: 200,
    status: 'OK',
    data: {
      Profile: {
        Entity: {
          Id: '67BA331332AF6263',
          Type: 'title_player_account',
          TypeString: 'title_player_account',
        },
        EntityChain: 'title_player_account!BDA2F45267E09A44/ALSLF/D99A2D9D9E5FDD94/67BCE31312AF6263/',
        VersionNumber: 0,
        Lineage: {
          NamespaceId: 'BDA2F96667E09A44',
          TitleId: 'asdfas',
          MasterPlayerAccountId: 'D99A2ASD9E5FDD94',
          TitlePlayerAccountId: '67BCE3131SFE263',
        },
        Created: '2020-12-08T19:19:53.37Z',
      },
    },
  },
};

const mockProfileUnauthorizedResponse = {
  status: 200,
  statusText: 'OK',
  data: {
    code: 401,
    status: 'Unauthorized',
    error: 'NotAuthenticated',
    errorCode: 1074,
    errorMessage: 'This API method does not allow anonymous callers.',
  },
};

// Mock response from your AzureFunction (the one refered to by FunctionName)
const mockFunctionResponse = {
  status: 200,
  statusText: 'OK',
  data: {},
};

const defaultRequestBody = {
  FunctionName: 'RequestMatch',
  Entity: {
    Id: 'asldkf',
    Type: 'asdfasd',
    TypeString: 'asdfasldfj',
  },
};

const requestBodyWithoutEntity = {
  FunctionName: 'RequestMatch',
};

const defaultHeaders = {
  'content-type': 'application/json; charset=utf-8',
  accept: '*/*',
  'accept-encoding': 'deflate, gzip',
  host: 'localhost:7071',
  'user-agent': 'Crimson/++UE4+Release-4.25-CL-0 Windows/10.0.18363.1.256.64bit',
  'content-length': '31',
  'x-playfabsdk': 'UE4MKPL-1.48.201014',
  'x-entitytoken':
    'M3x7ImkiOiIyMDIwLTEyLTA4VDAwOjMxOjAzLjMzMTIwMDhaIiwiaWRwIjoiQ3VzdG9tIiwiZSI6IjIwMjAtMTItMDlUMDA6MzE6MDMuMzMxMjAwOFoiLCJoIjoiMzI1NkUyMjI4MjVFQUNFNiIsInMiOiJjYWw3SzhKN3B1dUFleTNONjY2bXJ6Qk5zc1RnditDSHBKOHJGZ1FlbUw4PSIsImVjIjoidGl0bGVfcGxheWVyX2FjY291bnQhQkRBMkY5NjY2N0UwOUE0NC83RTNGQi8xOUVGMEMzQkQxNUMzMzQ3L0U4Q0Y2Qjg0RkQ2MEZBMDQvIiwiZWkiOiJFOENGNkI4NEZENjBGQTA0IiwiZXQiOiJ0aXRsFjfobow8ZXJfYWNjb3VudCJ9',
};

const headersWithoutComrpression = {
  'content-type': 'application/json; charset=utf-8',
  accept: '*/*',
  host: 'localhost:7071',
  'user-agent': 'Crimson/++UE4+Release-4.25-CL-0 Windows/10.0.18363.1.256.64bit',
  'content-length': '31',
  'x-playfabsdk': 'UE4MKPL-1.48.201014',
  'x-entitytoken':
    'M3x7ImkiOiIyMDIwLTEyLTA4VDAwOjMxOjAzLjMzMTIwMDhaIiwiaWRwIjoiQ3VzdG9tIiwiZSI6IjIwMjAtMTItMDlUMDA6MzE6MDMuMzMxMjAwOFoiLCJoIjoiMzI1NkUyMjI4MjVFQUNFNiIsInMiOiJjYWw3SzhKN3B1dUFleTNONjY2bXJ6Qk5zc1RnditDSHBKOHJGZ1FlbUw4PSIsImVjIjoidGl0bGVfcGxheWVyX2FjY291bnQhQkRBMkY5NjY2N0UwOUE0NC83RTNGQi8xOUVGMEMzQkQxNUMzMzQ3L0U4Q0Y2Qjg0RkQ2MEZBMDQvIiwiZWkiOiJFOENGNkI4NEZENjBGQTA0IiwiZXQiOiJ0aXRsFjfobow8ZXJfYWNjb3VudCJ9',
};

const headersWithoutEntityToken = {
  'content-type': 'application/json; charset=utf-8',
  accept: '*/*',
  'accept-encoding': 'deflate, gzip',
  host: 'localhost:7071',
  'user-agent': 'Crimson/++UE4+Release-4.25-CL-0 Windows/10.0.18363.1.256.64bit',
  'content-length': '31',
  'x-playfabsdk': 'UE4MKPL-1.48.201014',
};

interface BootstrapParams {
  body?: object;
  headers?: object;
}

const bootstrappedFunction = async ({ body = defaultRequestBody, headers = defaultHeaders }: BootstrapParams = {}) => {
  return runStubFunctionFromBindings(
    functionToTest,
    [
      {
        type: 'httpTrigger',
        name: 'req',
        direction: 'in',
        data: createHttpTrigger('POST', 'http://localhost:7071/CloudScript/ExecuteFunction', headers, {}, body),
      },
      { type: 'http', name: 'res', direction: 'out' },
    ],
    new Date(),
  );
};

describe('ExecuteFunction', () => {
  process.env.PLAYFAB_TITLE_ID = 'TESTID';

  it('Responds successfully with valid params', async () => {
    const mockedAxios = jest.spyOn(axios, 'post');
    mockedAxios.mockResolvedValueOnce(mockProfileSuccessResponse).mockResolvedValueOnce(mockFunctionResponse);

    const context = await bootstrappedFunction();
    expect(context).toHaveProperty('res.status', 200);

    mockedAxios.mockRestore();
  });

  it('Calls playfab to fetch a profile', async () => {
    const mockedAxios = jest.spyOn(axios, 'post');
    mockedAxios.mockResolvedValueOnce(mockProfileSuccessResponse).mockResolvedValueOnce(mockFunctionResponse);

    await bootstrappedFunction();
    expect(mockedAxios).toHaveBeenCalledWith(
      '/Profile/GetProfile',
      { Entity: { Id: 'asldkf', Type: 'asdfasd', TypeString: 'asdfasd' } },
      {
        baseURL: 'https://TESTID.playfabapi.com',
        headers: {
          'Content-Type': 'application/json',
          'X-EntityToken':
            'M3x7ImkiOiIyMDIwLTEyLTA4VDAwOjMxOjAzLjMzMTIwMDhaIiwiaWRwIjoiQ3VzdG9tIiwiZSI6IjIwMjAtMTItMDlUMDA6MzE6MDMuMzMxMjAwOFoiLCJoIjoiMzI1NkUyMjI4MjVFQUNFNiIsInMiOiJjYWw3SzhKN3B1dUFleTNONjY2bXJ6Qk5zc1RnditDSHBKOHJGZ1FlbUw4PSIsImVjIjoidGl0bGVfcGxheWVyX2FjY291bnQhQkRBMkY5NjY2N0UwOUE0NC83RTNGQi8xOUVGMEMzQkQxNUMzMzQ3L0U4Q0Y2Qjg0RkQ2MEZBMDQvIiwiZWkiOiJFOENGNkI4NEZENjBGQTA0IiwiZXQiOiJ0aXRsFjfobow8ZXJfYWNjb3VudCJ9',
        },
      },
    );
    mockedAxios.mockRestore();
  });

  it('Calls local Azure Function', async () => {
    const mockedAxios = jest.spyOn(axios, 'post');
    mockedAxios.mockResolvedValueOnce(mockProfileSuccessResponse).mockResolvedValueOnce(mockFunctionResponse);

    await bootstrappedFunction();

    expect(mockedAxios).toHaveBeenCalledWith(
      '/api/RequestMatch',
      '{"TitleAuthenticationContext":{"Id":"TESTID","EntityToken":"M3x7ImkiOiIyMDIwLTEyLTA4VDAwOjMxOjAzLjMzMTIwMDhaIiwiaWRwIjoiQ3VzdG9tIiwiZSI6IjIwMjAtMTItMDlUMDA6MzE6MDMuMzMxMjAwOFoiLCJoIjoiMzI1NkUyMjI4MjVFQUNFNiIsInMiOiJjYWw3SzhKN3B1dUFleTNONjY2bXJ6Qk5zc1RnditDSHBKOHJGZ1FlbUw4PSIsImVjIjoidGl0bGVfcGxheWVyX2FjY291bnQhQkRBMkY5NjY2N0UwOUE0NC83RTNGQi8xOUVGMEMzQkQxNUMzMzQ3L0U4Q0Y2Qjg0RkQ2MEZBMDQvIiwiZWkiOiJFOENGNkI4NEZENjBGQTA0IiwiZXQiOiJ0aXRsFjfobow8ZXJfYWNjb3VudCJ9"},"CallerEntityProfile":{"Entity":{"Id":"67BA331332AF6263","Type":"title_player_account","TypeString":"title_player_account"},"EntityChain":"title_player_account!BDA2F45267E09A44/ALSLF/D99A2D9D9E5FDD94/67BCE31312AF6263/","VersionNumber":0,"Lineage":{"NamespaceId":"BDA2F96667E09A44","TitleId":"asdfas","MasterPlayerAccountId":"D99A2ASD9E5FDD94","TitlePlayerAccountId":"67BCE3131SFE263"},"Created":"2020-12-08T19:19:53.37Z"}}',
      { baseURL: 'http://localhost:7071', headers: { 'Content-Type': 'application/json' } },
    );
    mockedAxios.mockRestore();
  });

  it('Returns a gzipped response body', async () => {
    const mockedAxios = jest.spyOn(axios, 'post');
    mockedAxios.mockResolvedValueOnce(mockProfileSuccessResponse).mockResolvedValueOnce(mockFunctionResponse);

    const response = await bootstrappedFunction();
    expect(Buffer.isBuffer(response.res.body)).toBe(true);
    ungzip(response.res.body)
      .then((uncompressed) => {
        return gzip(uncompressed);
      })
      .then((compressed) => {
        expect(compressed).toEqual(response.res.body);
      });

    mockedAxios.mockRestore();
  });

  it('Respondes with a full "ExecuteFunctionResult"', async () => {
    const mockedAxios = jest.spyOn(axios, 'post');
    mockedAxios.mockResolvedValueOnce(mockProfileSuccessResponse).mockResolvedValueOnce(mockFunctionResponse);

    const response = await bootstrappedFunction();
    const unzippedResponseBody = await ungzip(response.res.body);
    const responseString = unzippedResponseBody.toString();
    const responseBody = JSON.parse(responseString);
    expect(responseBody).toHaveProperty('data.ExecutionTimeMilliseconds');
    expect(responseBody).toHaveProperty('data.FunctionName');
    expect(responseBody).toHaveProperty('data.FunctionResult');
    expect(responseBody).toHaveProperty('data.FunctionResultTooLarge');

    mockedAxios.mockRestore();
  });

  it('Does not gzip the result if gzip header is not present', async () => {
    const mockedAxios = jest.spyOn(axios, 'post');
    mockedAxios.mockResolvedValueOnce(mockProfileSuccessResponse).mockResolvedValueOnce(mockFunctionResponse);

    const response = await bootstrappedFunction({ headers: headersWithoutComrpression });
    expect(Buffer.isBuffer(response.res.body)).toBe(true);
    expect(async () => {
      await ungzip(response.res.body);
    })
      .rejects // https://stackoverflow.com/a/61214808
      .toThrowError('Error: incorrect header check');

    mockedAxios.mockRestore();
  });

  it('Returns a 401 when no Caller Entity Token header is present', async () => {
    const mockedAxios = jest.spyOn(axios, 'post');
    mockedAxios.mockResolvedValueOnce(mockProfileUnauthorizedResponse).mockResolvedValueOnce(mockFunctionResponse);
    const response = await bootstrappedFunction({ headers: headersWithoutEntityToken });
    expect(response).toHaveProperty('res.status', 401);
    mockedAxios.mockRestore();
  });

  it('Returns a 200 when Entity is present in the request body', async () => {
    const mockedAxios = jest.spyOn(axios, 'post');
    mockedAxios.mockResolvedValueOnce(mockProfileSuccessResponse).mockResolvedValueOnce(mockFunctionResponse);
    const response = await bootstrappedFunction({ body: requestBodyWithoutEntity });
    expect(response).toHaveProperty('res.status', 200);
    mockedAxios.mockRestore();
  });
});
