// Set test environment BEFORE imports
process.env.NODE_ENV = 'test';

import * as tl from 'azure-pipelines-task-lib/task';
import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';
import { EventEmitter } from 'events';
import {
    run,
    parseAdditionalArguments,
    getEntraAccessToken,
    getSqlResourceForServer,
    requestUrl
} from '../index';

// Mock modules
jest.mock('azure-pipelines-task-lib/task');
jest.mock('fs');
jest.mock('https');
jest.mock('http');

describe('SqlPackage Publisher Tests', () => {
    let mockGetInput: jest.Mock;
    let mockGetPathInput: jest.Mock;
    let mockExec: jest.Mock;
    let mockSetResult: jest.Mock;
    let mockExistsSync: jest.Mock;
    let mockGetEndpointAuthorization: jest.Mock;
    let mockGetEndpointAuthorizationScheme: jest.Mock;
    let mockGetEndpointAuthorizationParameter: jest.Mock;
    let mockGetEndpointDataParameter: jest.Mock;
    let mockSetSecret: jest.Mock;
    let mockHttpsRequest: jest.Mock;
    let mockHttpRequest: jest.Mock;
    let consoleLogSpy: jest.SpyInstance;
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();

        mockGetInput = tl.getInput as jest.Mock;
        mockGetPathInput = tl.getPathInput as jest.Mock;
        mockExec = tl.exec as jest.Mock;
        mockSetResult = tl.setResult as jest.Mock;
        mockExistsSync = fs.existsSync as jest.Mock;
        mockGetEndpointAuthorization = tl.getEndpointAuthorization as jest.Mock;
        mockGetEndpointAuthorizationScheme = tl.getEndpointAuthorizationScheme as jest.Mock;
        mockGetEndpointAuthorizationParameter = tl.getEndpointAuthorizationParameter as jest.Mock;
        mockGetEndpointDataParameter = tl.getEndpointDataParameter as jest.Mock;
        mockSetSecret = tl.setSecret as jest.Mock;
        mockHttpsRequest = https.request as unknown as jest.Mock;
        mockHttpRequest = http.request as unknown as jest.Mock;

        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

        // Default successful responses
        mockExec.mockReset().mockResolvedValue(0);
        mockExistsSync.mockReset().mockReturnValue(true);
        mockGetPathInput.mockReset().mockReturnValue('');
        mockGetInput.mockReset().mockReturnValue('');
        mockGetEndpointAuthorization.mockReset().mockReturnValue(undefined);
        mockGetEndpointAuthorizationScheme.mockReset().mockReturnValue(undefined);
        mockGetEndpointAuthorizationParameter.mockReset().mockReturnValue(undefined);
        mockGetEndpointDataParameter.mockReset().mockReturnValue(undefined);
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        consoleErrorSpy.mockRestore();
    });

    describe('Input Validation', () => {
        it('should fail if dacpacFile is not provided', async () => {
            mockGetPathInput.mockReturnValue('');
            mockGetInput.mockReturnValue('server');

            await run();

            expect(mockSetResult).toHaveBeenCalledWith(
                tl.TaskResult.Failed,
                expect.stringContaining('DACPAC file path is required')
            );
        });

        it('should fail if dacpacFile does not exist', async () => {
            mockGetPathInput.mockReturnValue('/path/to/missing.dacpac');
            mockGetInput.mockReturnValue('server');
            mockExistsSync.mockReturnValue(false);

            await run();

            expect(mockSetResult).toHaveBeenCalledWith(
                tl.TaskResult.Failed,
                expect.stringContaining('DACPAC file not found')
            );
        });

        it('should fail if SqlPackage is not available', async () => {
            mockGetPathInput.mockReturnValueOnce('/path/to/test.dacpac');
            mockGetInput.mockReturnValue('server');
            mockExec.mockRejectedValueOnce(new Error('Command not found'));

            await run();

            expect(mockSetResult).toHaveBeenCalledWith(
                tl.TaskResult.Failed,
                expect.stringContaining('SqlPackage not found in PATH')
            );
        });
    });

    describe('Windows Authentication', () => {
        it('should build correct connection string for Windows Authentication', async () => {
            mockGetPathInput.mockReturnValueOnce('/path/to/test.dacpac').mockReturnValueOnce(null);
            mockGetInput
                .mockReturnValueOnce('server') // targetMethod
                .mockReturnValueOnce('') // additionalArguments
                .mockReturnValueOnce('myserver') // serverName
                .mockReturnValueOnce('mydb') // databaseName
                .mockReturnValueOnce('windowsAuthentication'); // authenticationType

            mockExec.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

            await run();

            expect(mockExec).toHaveBeenCalledWith('sqlpackage', expect.arrayContaining([
                '/Action:Publish',
                '/SourceFile:/path/to/test.dacpac',
                '/TargetServerName:myserver',
                '/TargetDatabaseName:mydb'
            ]));
        });
    });

    describe('SQL Server Authentication', () => {
        it('should build correct connection string for SQL Authentication', async () => {
            mockGetPathInput.mockReturnValueOnce('/path/to/test.dacpac').mockReturnValueOnce(null);
            mockGetInput
                .mockReturnValueOnce('server') // targetMethod
                .mockReturnValueOnce('') // additionalArguments
                .mockReturnValueOnce('myserver') // serverName
                .mockReturnValueOnce('mydb') // databaseName
                .mockReturnValueOnce('sqlServerAuthentication') // authenticationType
                .mockReturnValueOnce('sa') // sqlUsername
                .mockReturnValueOnce('password123'); // sqlPassword

            mockExec.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

            await run();

            expect(mockExec).toHaveBeenCalledWith('sqlpackage', expect.arrayContaining([
                '/Action:Publish',
                '/SourceFile:/path/to/test.dacpac',
                '/TargetServerName:myserver',
                '/TargetDatabaseName:mydb',
                '/TargetUser:sa',
                '/TargetPassword:password123'
            ]));
        });

        it('should fail if SQL username is missing', async () => {
            mockGetPathInput.mockReturnValueOnce('/path/to/test.dacpac');
            mockGetInput
                .mockReturnValueOnce('server')
                .mockReturnValueOnce('')
                .mockReturnValueOnce('myserver')
                .mockReturnValueOnce('mydb')
                .mockReturnValueOnce('sqlServerAuthentication')
                .mockReturnValueOnce('') // empty username
                .mockReturnValueOnce('password');

            mockExec.mockResolvedValueOnce(0);

            await run();

            expect(mockSetResult).toHaveBeenCalledWith(
                tl.TaskResult.Failed,
                expect.stringContaining('username and password are required')
            );
        });
    });

    describe('Azure Active Directory Authentication', () => {
        it('should build correct connection string for Azure AD', async () => {
            mockGetPathInput.mockReturnValueOnce('/path/to/test.dacpac').mockReturnValueOnce(null);
            mockGetInput
                .mockReturnValueOnce('server')
                .mockReturnValueOnce('')
                .mockReturnValueOnce('myserver.database.windows.net')
                .mockReturnValueOnce('mydb')
                .mockReturnValueOnce('azureActiveDirectory');

            mockExec.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

            await run();

            expect(mockExec).toHaveBeenCalledWith('sqlpackage', expect.arrayContaining([
                '/Action:Publish',
                '/SourceFile:/path/to/test.dacpac',
                '/TargetServerName:myserver.database.windows.net',
                '/TargetDatabaseName:mydb',
                '/TargetAuthenticationType:ActiveDirectoryIntegrated'
            ]));
        });
    });

    describe('Entra Integrated Authentication', () => {
        function mockHttpResponse(statusCode: number, data: string, isHttp = false) {
            const mockReq = new EventEmitter() as any;
            mockReq.write = jest.fn();
            mockReq.end = jest.fn();

            const mockFn = isHttp ? mockHttpRequest : mockHttpsRequest;
            const spy = mockFn.mockImplementation(((...args: any[]) => {
                const callback = args.find((a: any) => typeof a === 'function');
                const mockRes = new EventEmitter() as any;
                mockRes.statusCode = statusCode;

                process.nextTick(() => {
                    if (callback) {
                        callback(mockRes);
                    }
                    mockRes.emit('data', data);
                    mockRes.emit('end');
                });

                return mockReq;
            }) as any);

            return { spy, mockReq };
        }

        it('should build correct arguments using direct AccessToken in service connection', async () => {
            mockGetPathInput.mockReturnValueOnce('/path/to/test.dacpac').mockReturnValueOnce(null);
            mockGetInput
                .mockReturnValueOnce('server')
                .mockReturnValueOnce('')
                .mockReturnValueOnce('myserver.database.windows.net')
                .mockReturnValueOnce('mydb')
                .mockReturnValueOnce('entraIntegrated')
                .mockReturnValueOnce('MyServiceConnection');

            mockGetEndpointAuthorization.mockReturnValue({
                scheme: 'OAuth',
                parameters: {
                    AccessToken: 'direct-access-token-123'
                }
            });

            mockExec.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

            await run();

            expect(mockSetSecret).toHaveBeenCalledWith('direct-access-token-123');
            expect(mockExec).toHaveBeenCalledWith('sqlpackage', expect.arrayContaining([
                '/Action:Publish',
                '/SourceFile:/path/to/test.dacpac',
                '/TargetServerName:myserver.database.windows.net',
                '/TargetDatabaseName:mydb',
                '/AccessToken:direct-access-token-123'
            ]));
        });

        it('should acquire token using Service Principal with client secret', async () => {
            const { spy } = mockHttpResponse(200, JSON.stringify({
                access_token: 'sp-secret-token-456',
                token_type: 'Bearer',
                expires_in: 3599
            }));

            mockGetPathInput.mockReturnValueOnce('/path/to/test.dacpac').mockReturnValueOnce(null);
            mockGetInput
                .mockReturnValueOnce('server')
                .mockReturnValueOnce('')
                .mockReturnValueOnce('myserver.database.windows.net')
                .mockReturnValueOnce('mydb')
                .mockReturnValueOnce('entraIntegrated')
                .mockReturnValueOnce('MySPServiceConnection');

            mockGetEndpointAuthorization.mockReturnValue({
                scheme: 'ServicePrincipal',
                parameters: {
                    tenantid: 'tenant-guid',
                    serviceprincipalid: 'client-guid',
                    serviceprincipalkey: 'secret-key-xyz'
                }
            });

            mockExec.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

            await run();

            expect(mockSetSecret).toHaveBeenCalledWith('sp-secret-token-456');
            expect(mockExec).toHaveBeenCalledWith('sqlpackage', expect.arrayContaining([
                '/Action:Publish',
                '/SourceFile:/path/to/test.dacpac',
                '/TargetServerName:myserver.database.windows.net',
                '/TargetDatabaseName:mydb',
                '/AccessToken:sp-secret-token-456'
            ]));

            spy.mockRestore();
        });

        it('should acquire token using Workload Identity Federation with federatedToken', async () => {
            const { spy, mockReq } = mockHttpResponse(200, JSON.stringify({
                access_token: 'wif-token-789',
                token_type: 'Bearer',
                expires_in: 3599
            }));

            mockGetPathInput.mockReturnValueOnce('/path/to/test.dacpac').mockReturnValueOnce(null);
            mockGetInput
                .mockReturnValueOnce('server')
                .mockReturnValueOnce('')
                .mockReturnValueOnce('myserver.database.windows.net')
                .mockReturnValueOnce('mydb')
                .mockReturnValueOnce('entraIntegrated')
                .mockReturnValueOnce('MyWIFServiceConnection');

            mockGetEndpointAuthorization.mockReturnValue({
                scheme: 'WorkloadIdentityFederation',
                parameters: {
                    tenantid: 'tenant-guid',
                    serviceprincipalid: 'client-guid',
                    federatedToken: 'fed-token-abc'
                }
            });

            mockExec.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

            await run();

            expect(mockReq.write).toHaveBeenCalledWith(expect.stringContaining('client_assertion=fed-token-abc'));
            expect(mockSetSecret).toHaveBeenCalledWith('wif-token-789');
            expect(mockExec).toHaveBeenCalledWith('sqlpackage', expect.arrayContaining([
                '/AccessToken:wif-token-789'
            ]));

            spy.mockRestore();
        });

        it('should acquire token using Workload Identity Federation falling back to process.env.SYSTEM_ACCESSTOKEN', async () => {
            const originalEnv = process.env.SYSTEM_ACCESSTOKEN;
            process.env.SYSTEM_ACCESSTOKEN = 'env-oidc-token';

            const { spy, mockReq } = mockHttpResponse(200, JSON.stringify({
                access_token: 'wif-env-token',
                token_type: 'Bearer',
                expires_in: 3599
            }));

            mockGetPathInput.mockReturnValueOnce('/path/to/test.dacpac').mockReturnValueOnce(null);
            mockGetInput
                .mockReturnValueOnce('server')
                .mockReturnValueOnce('')
                .mockReturnValueOnce('myserver.database.windows.net')
                .mockReturnValueOnce('mydb')
                .mockReturnValueOnce('entraIntegrated')
                .mockReturnValueOnce('MyWIFServiceConnection');

            mockGetEndpointAuthorization.mockReturnValue({
                scheme: 'WorkloadIdentityFederation',
                parameters: {
                    tenantid: 'tenant-guid',
                    serviceprincipalid: 'client-guid'
                }
            });

            mockExec.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

            await run();

            expect(mockReq.write).toHaveBeenCalledWith(expect.stringContaining('client_assertion=env-oidc-token'));
            expect(mockSetSecret).toHaveBeenCalledWith('wif-env-token');

            if (originalEnv === undefined) {
                delete process.env.SYSTEM_ACCESSTOKEN;
            } else {
                process.env.SYSTEM_ACCESSTOKEN = originalEnv;
            }
            spy.mockRestore();
        });

        it('should acquire token using Managed Service Identity', async () => {
            const { spy } = mockHttpResponse(200, JSON.stringify({
                access_token: 'msi-token-101',
                token_type: 'Bearer',
                expires_in: 3599
            }), true);

            mockGetPathInput.mockReturnValueOnce('/path/to/test.dacpac').mockReturnValueOnce(null);
            mockGetInput
                .mockReturnValueOnce('server')
                .mockReturnValueOnce('')
                .mockReturnValueOnce('myserver.database.windows.net')
                .mockReturnValueOnce('mydb')
                .mockReturnValueOnce('entraIntegrated')
                .mockReturnValueOnce('MyMSIServiceConnection');

            mockGetEndpointAuthorization.mockReturnValue({
                scheme: 'ManagedServiceIdentity',
                parameters: {}
            });

            mockExec.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

            await run();

            expect(mockSetSecret).toHaveBeenCalledWith('msi-token-101');
            expect(mockExec).toHaveBeenCalledWith('sqlpackage', expect.arrayContaining([
                '/AccessToken:msi-token-101'
            ]));

            spy.mockRestore();
        });

        it('should use correct resource and scope for US Gov cloud', async () => {
            const { spy, mockReq } = mockHttpResponse(200, JSON.stringify({
                access_token: 'gov-token',
                token_type: 'Bearer'
            }));

            mockGetPathInput.mockReturnValueOnce('/path/to/test.dacpac').mockReturnValueOnce(null);
            mockGetInput
                .mockReturnValueOnce('server')
                .mockReturnValueOnce('')
                .mockReturnValueOnce('myserver.database.usgovcloudapi.net')
                .mockReturnValueOnce('mydb')
                .mockReturnValueOnce('entraIntegrated')
                .mockReturnValueOnce('GovConnection');

            mockGetEndpointAuthorization.mockReturnValue({
                scheme: 'ServicePrincipal',
                parameters: {
                    tenantid: 'tenant-gov',
                    serviceprincipalid: 'client-gov',
                    serviceprincipalkey: 'key-gov'
                }
            });

            mockExec.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

            await run();

            expect(mockReq.write).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent('https://database.usgovcloudapi.net/.default')));
            expect(mockExec).toHaveBeenCalledWith('sqlpackage', expect.arrayContaining([
                '/AccessToken:gov-token'
            ]));

            spy.mockRestore();
        });

        it('should use correct resource and scope for China cloud', async () => {
            const { spy, mockReq } = mockHttpResponse(200, JSON.stringify({
                access_token: 'china-token',
                token_type: 'Bearer'
            }));

            mockGetPathInput.mockReturnValueOnce('/path/to/test.dacpac').mockReturnValueOnce(null);
            mockGetInput
                .mockReturnValueOnce('server')
                .mockReturnValueOnce('')
                .mockReturnValueOnce('myserver.database.chinacloudapi.cn')
                .mockReturnValueOnce('mydb')
                .mockReturnValueOnce('entraIntegrated')
                .mockReturnValueOnce('ChinaConnection');

            mockGetEndpointAuthorization.mockReturnValue({
                scheme: 'ServicePrincipal',
                parameters: {
                    tenantid: 'tenant-china',
                    serviceprincipalid: 'client-china',
                    serviceprincipalkey: 'key-china'
                }
            });

            mockExec.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

            await run();

            expect(mockReq.write).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent('https://database.chinacloudapi.cn/.default')));
            expect(mockExec).toHaveBeenCalledWith('sqlpackage', expect.arrayContaining([
                '/AccessToken:china-token'
            ]));

            spy.mockRestore();
        });

        it('should use custom authority URL when configured in endpoint data', async () => {
            let requestedUrl = '';
            const mockReq = new EventEmitter() as any;
            mockReq.write = jest.fn();
            mockReq.end = jest.fn();

            mockHttpsRequest.mockImplementation((url: any, _options: any, callback: any) => {
                requestedUrl = url.toString();
                const mockRes = new EventEmitter() as any;
                mockRes.statusCode = 200;

                process.nextTick(() => {
                    if (callback) callback(mockRes);
                    mockRes.emit('data', JSON.stringify({ access_token: 'custom-auth-token' }));
                    mockRes.emit('end');
                });

                return mockReq;
            });

            mockGetPathInput.mockReturnValueOnce('/path/to/test.dacpac').mockReturnValueOnce(null);
            mockGetInput
                .mockReturnValueOnce('server')
                .mockReturnValueOnce('')
                .mockReturnValueOnce('myserver.database.windows.net')
                .mockReturnValueOnce('mydb')
                .mockReturnValueOnce('entraIntegrated')
                .mockReturnValueOnce('CustomConnection');

            mockGetEndpointAuthorization.mockReturnValue({
                scheme: 'ServicePrincipal',
                parameters: {
                    tenantid: 'my-tenant',
                    serviceprincipalid: 'my-client',
                    serviceprincipalkey: 'my-key'
                }
            });

            mockGetEndpointDataParameter.mockImplementation((_sc: string, param: string) => {
                if (param === 'environmentAuthorityUrl' || param === 'activeDirectoryAuthority') {
                    return 'https://login.microsoftonline.us';
                }
                return undefined;
            });

            mockExec.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

            await run();

            expect(requestedUrl).toContain('https://login.microsoftonline.us/my-tenant/oauth2/v2.0/token');
            expect(mockExec).toHaveBeenCalledWith('sqlpackage', expect.arrayContaining([
                '/AccessToken:custom-auth-token'
            ]));
        });

        it('should fail if azureSubscription input is missing', async () => {
            mockGetPathInput.mockReturnValueOnce('/path/to/test.dacpac');
            mockGetInput
                .mockReturnValueOnce('server')
                .mockReturnValueOnce('')
                .mockReturnValueOnce('myserver')
                .mockReturnValueOnce('mydb')
                .mockReturnValueOnce('entraIntegrated')
                .mockReturnValueOnce(''); // missing azureSubscription

            mockExec.mockResolvedValueOnce(0);

            await run();

            expect(mockSetResult).toHaveBeenCalledWith(
                tl.TaskResult.Failed,
                expect.stringContaining('Azure Subscription / Service Connection is required')
            );
        });

        it('should fail if tenant ID or service principal ID is missing', async () => {
            mockGetPathInput.mockReturnValueOnce('/path/to/test.dacpac');
            mockGetInput
                .mockReturnValueOnce('server')
                .mockReturnValueOnce('')
                .mockReturnValueOnce('myserver')
                .mockReturnValueOnce('mydb')
                .mockReturnValueOnce('entraIntegrated')
                .mockReturnValueOnce('BadConnection');

            mockGetEndpointAuthorization.mockReturnValue({
                scheme: 'ServicePrincipal',
                parameters: {
                    serviceprincipalkey: 'key-only'
                }
            });

            mockExec.mockResolvedValueOnce(0);

            await run();

            expect(mockSetResult).toHaveBeenCalledWith(
                tl.TaskResult.Failed,
                expect.stringContaining('missing tenant ID or service principal ID')
            );
        });

        it('should fail if no valid credentials found for service connection', async () => {
            mockGetPathInput.mockReturnValueOnce('/path/to/test.dacpac');
            mockGetInput
                .mockReturnValueOnce('server')
                .mockReturnValueOnce('')
                .mockReturnValueOnce('myserver')
                .mockReturnValueOnce('mydb')
                .mockReturnValueOnce('entraIntegrated')
                .mockReturnValueOnce('EmptyConnection');

            mockGetEndpointAuthorization.mockReturnValue({
                scheme: 'ServicePrincipal',
                parameters: {
                    tenantid: 't-id',
                    serviceprincipalid: 'sp-id'
                    // No key, no federated token, no access token
                }
            });

            mockExec.mockResolvedValueOnce(0);

            await run();

            expect(mockSetResult).toHaveBeenCalledWith(
                tl.TaskResult.Failed,
                expect.stringContaining('Could not find valid credentials')
            );
        });

        it('should fail if token endpoint returns an error status with error_description', async () => {
            const { spy } = mockHttpResponse(400, JSON.stringify({
                error: 'invalid_client',
                error_description: 'AADSTS7000215: Invalid client secret is provided.'
            }));

            mockGetPathInput.mockReturnValueOnce('/path/to/test.dacpac');
            mockGetInput
                .mockReturnValueOnce('server')
                .mockReturnValueOnce('')
                .mockReturnValueOnce('myserver.database.windows.net')
                .mockReturnValueOnce('mydb')
                .mockReturnValueOnce('entraIntegrated')
                .mockReturnValueOnce('FailedConnection');

            mockGetEndpointAuthorization.mockReturnValue({
                scheme: 'ServicePrincipal',
                parameters: {
                    tenantid: 't-id',
                    serviceprincipalid: 'sp-id',
                    serviceprincipalkey: 'wrong-key'
                }
            });

            mockExec.mockResolvedValueOnce(0);

            await run();

            expect(mockSetResult).toHaveBeenCalledWith(
                tl.TaskResult.Failed,
                expect.stringContaining('AADSTS7000215: Invalid client secret is provided.')
            );

            spy.mockRestore();
        });

        it('should fail if IMDS endpoint returns an error', async () => {
            const { spy } = mockHttpResponse(500, 'Internal Server Error', true);

            mockGetPathInput.mockReturnValueOnce('/path/to/test.dacpac');
            mockGetInput
                .mockReturnValueOnce('server')
                .mockReturnValueOnce('')
                .mockReturnValueOnce('myserver.database.windows.net')
                .mockReturnValueOnce('mydb')
                .mockReturnValueOnce('entraIntegrated')
                .mockReturnValueOnce('MSIFailedConnection');

            mockGetEndpointAuthorization.mockReturnValue({
                scheme: 'ManagedServiceIdentity',
                parameters: {}
            });

            mockExec.mockResolvedValueOnce(0);

            await run();

            expect(mockSetResult).toHaveBeenCalledWith(
                tl.TaskResult.Failed,
                expect.stringContaining('Failed to acquire Microsoft Entra ID token from Managed Identity')
            );

            spy.mockRestore();
        });

        it('should fail if token response does not contain access_token', async () => {
            const { spy } = mockHttpResponse(200, JSON.stringify({
                foo: 'bar'
            }));

            mockGetPathInput.mockReturnValueOnce('/path/to/test.dacpac');
            mockGetInput
                .mockReturnValueOnce('server')
                .mockReturnValueOnce('')
                .mockReturnValueOnce('myserver.database.windows.net')
                .mockReturnValueOnce('mydb')
                .mockReturnValueOnce('entraIntegrated')
                .mockReturnValueOnce('NoTokenConnection');

            mockGetEndpointAuthorization.mockReturnValue({
                scheme: 'ServicePrincipal',
                parameters: {
                    tenantid: 't-id',
                    serviceprincipalid: 'sp-id',
                    serviceprincipalkey: 'key'
                }
            });

            mockExec.mockResolvedValueOnce(0);

            await run();

            expect(mockSetResult).toHaveBeenCalledWith(
                tl.TaskResult.Failed,
                expect.stringContaining('Token endpoint response did not contain access_token')
            );

            spy.mockRestore();
        });

        it('should handle IMDS error response with JSON error_description', async () => {
            const { spy } = mockHttpResponse(400, JSON.stringify({ error_description: 'IMDS failed' }), true);

            mockGetEndpointAuthorizationScheme.mockReturnValue('ManagedServiceIdentity');

            await expect(getEntraAccessToken('MSIConnection', 'myserver.database.windows.net'))
                .rejects
                .toThrow('Failed to acquire Microsoft Entra ID token from Managed Identity (HTTP 400): IMDS failed');

            spy.mockRestore();
        });

        it('should handle IMDS 200 response missing access_token', async () => {
            const { spy } = mockHttpResponse(200, JSON.stringify({ other_field: 'val' }), true);

            mockGetEndpointAuthorizationScheme.mockReturnValue('ManagedServiceIdentity');

            await expect(getEntraAccessToken('MSIConnection', 'myserver.database.windows.net'))
                .rejects
                .toThrow('Managed Identity response did not contain access_token');

            spy.mockRestore();
        });
    });

    describe('Connection String Method', () => {
        it('should use provided connection string', async () => {
            mockGetPathInput.mockReturnValueOnce('/path/to/test.dacpac').mockReturnValueOnce(null);
            mockGetInput
                .mockReturnValueOnce('connectionString')
                .mockReturnValueOnce('')
                .mockReturnValueOnce('Server=myserver;Database=mydb;User Id=sa;Password=pwd;');

            mockExec.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

            await run();

            expect(mockExec).toHaveBeenCalledWith('sqlpackage', expect.arrayContaining([
                '/TargetConnectionString:Server=myserver;Database=mydb;User Id=sa;Password=pwd;'
            ]));
        });

        it('should fail if connection string is empty', async () => {
            mockGetPathInput.mockReturnValueOnce('/path/to/test.dacpac');
            mockGetInput
                .mockReturnValueOnce('connectionString')
                .mockReturnValueOnce('')
                .mockReturnValueOnce('');

            mockExec.mockResolvedValueOnce(0);

            await run();

            expect(mockSetResult).toHaveBeenCalledWith(
                tl.TaskResult.Failed,
                expect.stringContaining('Connection string is required')
            );
        });
    });

    describe('Publish Profile', () => {
        it('should include publish profile if file exists', async () => {
            mockGetPathInput
                .mockReturnValueOnce('/path/to/test.dacpac')
                .mockReturnValueOnce('/path/to/profile.publish.xml');
            mockGetInput.mockReturnValueOnce('server').mockReturnValueOnce('');
            mockGetInput
                .mockReturnValueOnce('myserver')
                .mockReturnValueOnce('mydb')
                .mockReturnValueOnce('windowsAuthentication');

            mockExistsSync.mockReturnValue(true);

            // Mock statSync to return a file
            const mockStatSync = jest.spyOn(fs, 'statSync');
            mockStatSync.mockReturnValueOnce({ isFile: () => true } as any);

            mockExec.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

            await run();

            expect(mockExec).toHaveBeenCalledWith('sqlpackage', expect.arrayContaining([
                '/Profile:/path/to/profile.publish.xml'
            ]));

            mockStatSync.mockRestore();
        });

        it('should skip publish profile if file does not exist', async () => {
            mockGetPathInput
                .mockReturnValueOnce('/path/to/test.dacpac')
                .mockReturnValueOnce('/path/to/missing.publish.xml');
            mockGetInput.mockReturnValueOnce('server').mockReturnValueOnce('');
            mockGetInput
                .mockReturnValueOnce('myserver')
                .mockReturnValueOnce('mydb')
                .mockReturnValueOnce('windowsAuthentication');

            mockExistsSync
                .mockReturnValueOnce(true) // dacpac exists
                .mockReturnValueOnce(false); // profile doesn't exist
            mockExec.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

            await run();

            const execCalls = mockExec.mock.calls;
            const sqlPackageCall = execCalls.find(call => call[0] === 'sqlpackage' && call[1].length > 1);
            expect(sqlPackageCall?.[1]).not.toContain('/Profile:/path/to/missing.publish.xml');
        });

        it('should skip publish profile if none is provided', async () => {
            mockGetPathInput
                .mockReturnValueOnce('/path/to/test.dacpac')
                .mockReturnValueOnce(null); // no profile provided
            mockGetInput.mockReturnValueOnce('server').mockReturnValueOnce('');
            mockGetInput
                .mockReturnValueOnce('myserver')
                .mockReturnValueOnce('mydb')
                .mockReturnValueOnce('windowsAuthentication');

            mockExistsSync.mockReturnValueOnce(true); // dacpac exists
            mockExec.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

            await run();

            const execCalls = mockExec.mock.calls;
            const sqlPackageCall = execCalls.find(call => call[0] === 'sqlpackage' && call[1].length > 1);
            const profileArg = sqlPackageCall?.[1].find((arg: string) => arg.startsWith('/Profile:'));
            expect(profileArg).toBeUndefined();
        });

        it('should skip publish profile if empty string is provided', async () => {
            mockGetPathInput
                .mockReturnValueOnce('/path/to/test.dacpac')
                .mockReturnValueOnce('   '); // empty/whitespace profile
            mockGetInput.mockReturnValueOnce('server').mockReturnValueOnce('');
            mockGetInput
                .mockReturnValueOnce('myserver')
                .mockReturnValueOnce('mydb')
                .mockReturnValueOnce('windowsAuthentication');

            mockExistsSync.mockReturnValueOnce(true); // dacpac exists
            mockExec.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

            await run();

            const execCalls = mockExec.mock.calls;
            const sqlPackageCall = execCalls.find(call => call[0] === 'sqlpackage' && call[1].length > 1);
            const profileArg = sqlPackageCall?.[1].find((arg: string) => arg.startsWith('/Profile:'));
            expect(profileArg).toBeUndefined();
        });

        it('should skip publish profile if it is a directory not a file', async () => {
            mockGetPathInput
                .mockReturnValueOnce('/path/to/test.dacpac')
                .mockReturnValueOnce('/path/to/directory');
            mockGetInput.mockReturnValueOnce('server').mockReturnValueOnce('');
            mockGetInput
                .mockReturnValueOnce('myserver')
                .mockReturnValueOnce('mydb')
                .mockReturnValueOnce('windowsAuthentication');

            mockExistsSync
                .mockReturnValueOnce(true) // dacpac exists
                .mockReturnValueOnce(true); // directory exists

            // Mock statSync to return a directory
            const mockStatSync = jest.spyOn(fs, 'statSync');
            mockStatSync.mockReturnValueOnce({ isFile: () => false } as any);

            mockExec.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

            await run();

            const execCalls = mockExec.mock.calls;
            const sqlPackageCall = execCalls.find(call => call[0] === 'sqlpackage' && call[1].length > 1);
            const profileArg = sqlPackageCall?.[1].find((arg: string) => arg.startsWith('/Profile:'));
            expect(profileArg).toBeUndefined();

            mockStatSync.mockRestore();
        });
    });

    describe('Additional Arguments', () => {
        it('should include single line additional arguments', async () => {
            mockGetPathInput.mockReturnValueOnce('/path/to/test.dacpac').mockReturnValueOnce(null);
            mockGetInput
                .mockReturnValueOnce('server')
                .mockReturnValueOnce('/p:BlockOnPossibleDataLoss=false')
                .mockReturnValueOnce('myserver')
                .mockReturnValueOnce('mydb')
                .mockReturnValueOnce('windowsAuthentication');

            mockExec.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

            await run();

            expect(mockExec).toHaveBeenCalledWith('sqlpackage', expect.arrayContaining([
                '/p:BlockOnPossibleDataLoss=false'
            ]));
        });

        it('should include multiline additional arguments', async () => {
            mockGetPathInput.mockReturnValueOnce('/path/to/test.dacpac').mockReturnValueOnce(null);
            mockGetInput
                .mockReturnValueOnce('server')
                .mockReturnValueOnce('/p:BlockOnPossibleDataLoss=false\n/p:DropObjectsNotInSource=true')
                .mockReturnValueOnce('myserver')
                .mockReturnValueOnce('mydb')
                .mockReturnValueOnce('windowsAuthentication');

            mockExec.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

            await run();

            expect(mockExec).toHaveBeenCalledWith('sqlpackage', expect.arrayContaining([
                '/p:BlockOnPossibleDataLoss=false',
                '/p:DropObjectsNotInSource=true'
            ]));
        });

        it('should filter out empty lines in additional arguments', async () => {
            mockGetPathInput.mockReturnValueOnce('/path/to/test.dacpac').mockReturnValueOnce(null);
            mockGetInput
                .mockReturnValueOnce('server')
                .mockReturnValueOnce('/p:BlockOnPossibleDataLoss=false\n\n/p:DropObjectsNotInSource=true\n  ')
                .mockReturnValueOnce('myserver')
                .mockReturnValueOnce('mydb')
                .mockReturnValueOnce('windowsAuthentication');

            mockExec.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

            await run();

            const execCalls = mockExec.mock.calls;
            const sqlPackageCall = execCalls.find(call => call[0] === 'sqlpackage' && call[1].length > 1);
            const args = sqlPackageCall?.[1] || [];

            expect(args).toContain('/p:BlockOnPossibleDataLoss=false');
            expect(args).toContain('/p:DropObjectsNotInSource=true');
            expect(args.filter((arg: string) => arg.trim() === '')).toHaveLength(0);
        });
    });

    describe('Command Execution', () => {
        it('should execute sqlpackage with correct arguments', async () => {
            mockGetPathInput.mockReturnValueOnce('/path/to/test.dacpac').mockReturnValueOnce(null);
            mockGetInput
                .mockReturnValueOnce('server')
                .mockReturnValueOnce('')
                .mockReturnValueOnce('myserver')
                .mockReturnValueOnce('mydb')
                .mockReturnValueOnce('windowsAuthentication');

            mockExec.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

            await run();

            expect(mockExec).toHaveBeenCalledWith('sqlpackage', expect.arrayContaining([
                '/Action:Publish',
                '/SourceFile:/path/to/test.dacpac',
                '/TargetServerName:myserver',
                '/TargetDatabaseName:mydb'
            ]));
        });

        it('should succeed when sqlpackage returns 0', async () => {
            mockGetPathInput.mockReturnValueOnce('/path/to/test.dacpac').mockReturnValueOnce(null);
            mockGetInput
                .mockReturnValueOnce('server')
                .mockReturnValueOnce('')
                .mockReturnValueOnce('myserver')
                .mockReturnValueOnce('mydb')
                .mockReturnValueOnce('windowsAuthentication');

            mockExec.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

            await run();

            expect(mockSetResult).toHaveBeenCalledWith(
                tl.TaskResult.Succeeded,
                'Database deployment completed successfully'
            );
        });

        it('should fail when sqlpackage returns non-zero', async () => {
            mockGetPathInput.mockReturnValueOnce('/path/to/test.dacpac').mockReturnValueOnce(null);
            mockGetInput
                .mockReturnValueOnce('server')
                .mockReturnValueOnce('')
                .mockReturnValueOnce('myserver')
                .mockReturnValueOnce('mydb')
                .mockReturnValueOnce('windowsAuthentication');

            mockExec.mockResolvedValueOnce(0).mockResolvedValueOnce(1);

            await run();

            expect(mockSetResult).toHaveBeenCalledWith(
                tl.TaskResult.Failed,
                expect.stringContaining('SqlPackage exited with code 1')
            );
        });
    });

    describe('Error Handling', () => {
        it('should handle missing server name', async () => {
            mockGetPathInput.mockReturnValueOnce('/path/to/test.dacpac').mockReturnValueOnce(null);
            mockGetInput
                .mockReturnValueOnce('server')
                .mockReturnValueOnce('')
                .mockReturnValueOnce('') // empty server
                .mockReturnValueOnce('mydb');

            mockExec.mockResolvedValueOnce(0);

            await run();

            expect(mockSetResult).toHaveBeenCalledWith(
                tl.TaskResult.Failed,
                expect.stringContaining('Server name and database name are required')
            );
        });

        it('should handle missing database name', async () => {
            mockGetPathInput.mockReturnValueOnce('/path/to/test.dacpac').mockReturnValueOnce(null);
            mockGetInput
                .mockReturnValueOnce('server')
                .mockReturnValueOnce('')
                .mockReturnValueOnce('myserver')
                .mockReturnValueOnce(''); // empty database

            mockExec.mockResolvedValueOnce(0);

            await run();

            expect(mockSetResult).toHaveBeenCalledWith(
                tl.TaskResult.Failed,
                expect.stringContaining('Server name and database name are required')
            );
        });

        it('should handle errors gracefully', async () => {
            mockGetPathInput.mockReturnValueOnce('/path/to/test.dacpac');
            mockGetInput.mockReturnValueOnce('server');
            mockExec.mockRejectedValueOnce(new Error('Unexpected error'));

            await run();

            expect(mockSetResult).toHaveBeenCalledWith(
                tl.TaskResult.Failed,
                expect.any(String)
            );
            expect(consoleErrorSpy).toHaveBeenCalled();
        });
    });

    describe('SqlPackage Command Construction', () => {
        it('should always include /Action:Publish', async () => {
            mockGetPathInput.mockReturnValueOnce('/path/to/test.dacpac').mockReturnValueOnce(null);
            mockGetInput
                .mockReturnValueOnce('server')
                .mockReturnValueOnce('')
                .mockReturnValueOnce('myserver')
                .mockReturnValueOnce('mydb')
                .mockReturnValueOnce('windowsAuthentication');

            mockExec.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

            await run();

            const execCalls = mockExec.mock.calls;
            const sqlPackageCall = execCalls.find(call => call[0] === 'sqlpackage' && call[1].length > 1);
            expect(sqlPackageCall?.[1]).toContain('/Action:Publish');
        });

        it('should include /SourceFile with dacpac path', async () => {
            mockGetPathInput.mockReturnValueOnce('/my/dacpac/file.dacpac').mockReturnValueOnce(null);
            mockGetInput
                .mockReturnValueOnce('server')
                .mockReturnValueOnce('')
                .mockReturnValueOnce('myserver')
                .mockReturnValueOnce('mydb')
                .mockReturnValueOnce('windowsAuthentication');

            mockExec.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

            await run();

            expect(mockExec).toHaveBeenCalledWith('sqlpackage', expect.arrayContaining([
                '/SourceFile:/my/dacpac/file.dacpac'
            ]));
        });
    });

    describe('Additional Arguments Parsing', () => {
        it('should parse space-separated arguments', () => {
            const input = '/p:Arg1=Value1 /p:Arg2=Value2 /p:Arg3=Value3';
            const result = parseAdditionalArguments(input);
            expect(result).toEqual(['/p:Arg1=Value1', '/p:Arg2=Value2', '/p:Arg3=Value3']);
        });

        it('should parse arguments with quoted values', () => {
            const input = '/v:Var1="Value with spaces" /v:Var2=Simple';
            const result = parseAdditionalArguments(input);
            expect(result).toEqual(['/v:Var1="Value with spaces"', '/v:Var2=Simple']);
        });

        it('should handle escaped quotes in values', () => {
            const input = '/v:Var="Value with \\"escaped\\" quotes"';
            const result = parseAdditionalArguments(input);
            expect(result).toEqual(['/v:Var="Value with "escaped" quotes"']);
        });

        it('should parse newline-separated arguments', () => {
            const input = '/p:Arg1=Value1\n/p:Arg2=Value2\n/p:Arg3=Value3';
            const result = parseAdditionalArguments(input);
            expect(result).toEqual(['/p:Arg1=Value1', '/p:Arg2=Value2', '/p:Arg3=Value3']);
        });

        it('should parse mixed space and newline-separated arguments', () => {
            const input = '/p:Arg1=Value1 /p:Arg2=Value2\n/p:Arg3=Value3 /p:Arg4=Value4';
            const result = parseAdditionalArguments(input);
            expect(result).toEqual(['/p:Arg1=Value1', '/p:Arg2=Value2', '/p:Arg3=Value3', '/p:Arg4=Value4']);
        });

        it('should handle complex real-world example', () => {
            const input = '/tec:Optional /p:DropObjectsNotInSource=false /p:ScriptDatabaseOptions=false /v:ServiceAccount=DOMAIN\\User /v:Group="Security Group" /v:Offshore="Offshore Group"';
            const result = parseAdditionalArguments(input);
            expect(result).toEqual([
                '/tec:Optional',
                '/p:DropObjectsNotInSource=false',
                '/p:ScriptDatabaseOptions=false',
                '/v:ServiceAccount=DOMAIN\\User',
                '/v:Group="Security Group"',
                '/v:Offshore="Offshore Group"'
            ]);
        });

        it('should handle empty input', () => {
            const input = '';
            const result = parseAdditionalArguments(input);
            expect(result).toEqual([]);
        });

        it('should handle whitespace-only input', () => {
            const input = '   \n  \n  ';
            const result = parseAdditionalArguments(input);
            expect(result).toEqual([]);
        });

        it('should preserve spaces within quoted values', () => {
            const input = '/v:Var="Value  with   multiple   spaces"';
            const result = parseAdditionalArguments(input);
            expect(result).toEqual(['/v:Var="Value  with   multiple   spaces"']);
        });

        it('should handle arguments with equals signs in quoted values', () => {
            const input = '/v:ConnectionString="Server=localhost;Database=Test"';
            const result = parseAdditionalArguments(input);
            expect(result).toEqual(['/v:ConnectionString="Server=localhost;Database=Test"']);
        });

        it('should handle multiple consecutive spaces between arguments', () => {
            const input = '/p:Arg1=Value1    /p:Arg2=Value2';
            const result = parseAdditionalArguments(input);
            expect(result).toEqual(['/p:Arg1=Value1', '/p:Arg2=Value2']);
        });

        it('should handle single argument', () => {
            const input = '/p:SingleArg=Value';
            const result = parseAdditionalArguments(input);
            expect(result).toEqual(['/p:SingleArg=Value']);
        });

        it('should handle argument with backslash in path', () => {
            const input = '/SourceFile:C:\\Path\\To\\File.dacpac';
            const result = parseAdditionalArguments(input);
            expect(result).toEqual(['/SourceFile:C:\\Path\\To\\File.dacpac']);
        });

        it('should handle Azure DevOps variable syntax', () => {
            const input = '/v:ServiceAccount=$(executionAccount) /v:Group="$(securityGroup)"';
            const result = parseAdditionalArguments(input);
            expect(result).toEqual(['/v:ServiceAccount=$(executionAccount)', '/v:Group="$(securityGroup)"']);
        });
    });

    describe('getSqlResourceForServer', () => {
        it('should return default Azure SQL database resource for undefined server', () => {
            const result = getSqlResourceForServer();
            expect(result).toEqual({
                resource: 'https://database.windows.net',
                scope: 'https://database.windows.net/.default'
            });
        });

        it('should return default Azure SQL database resource for commercial azure domain', () => {
            const result = getSqlResourceForServer('myserver.database.windows.net');
            expect(result).toEqual({
                resource: 'https://database.windows.net',
                scope: 'https://database.windows.net/.default'
            });
        });

        it('should return US Gov cloud resource for usgovcloudapi domain', () => {
            const result = getSqlResourceForServer('myserver.database.usgovcloudapi.net');
            expect(result).toEqual({
                resource: 'https://database.usgovcloudapi.net',
                scope: 'https://database.usgovcloudapi.net/.default'
            });
        });

        it('should return China cloud resource for chinacloudapi domain', () => {
            const result = getSqlResourceForServer('myserver.database.chinacloudapi.cn');
            expect(result).toEqual({
                resource: 'https://database.chinacloudapi.cn',
                scope: 'https://database.chinacloudapi.cn/.default'
            });
        });
    });

    describe('requestUrl', () => {
        it('should handle successful https request with body', async () => {
            const mockReq = new EventEmitter() as any;
            mockReq.write = jest.fn();
            mockReq.end = jest.fn();

            const spy = (jest.spyOn(https, 'request') as any).mockImplementation((_url: any, _options: any, callback: any) => {
                const mockRes = new EventEmitter() as any;
                mockRes.statusCode = 200;

                process.nextTick(() => {
                    if (callback) callback(mockRes);
                    mockRes.emit('data', 'response-data');
                    mockRes.emit('end');
                });

                return mockReq;
            });

            const res = await requestUrl('https://login.microsoftonline.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: 'test=1'
            });

            expect(res.statusCode).toBe(200);
            expect(res.data).toBe('response-data');
            expect(mockReq.write).toHaveBeenCalledWith('test=1');
            expect(mockReq.end).toHaveBeenCalled();

            spy.mockRestore();
        });

        it('should handle http request', async () => {
            const mockReq = new EventEmitter() as any;
            mockReq.write = jest.fn();
            mockReq.end = jest.fn();

            const spy = (jest.spyOn(http, 'request') as any).mockImplementation((_url: any, _options: any, callback: any) => {
                const mockRes = new EventEmitter() as any;
                mockRes.statusCode = 200;

                process.nextTick(() => {
                    if (callback) callback(mockRes);
                    mockRes.emit('data', 'imds-data');
                    mockRes.emit('end');
                });

                return mockReq;
            });

            const res = await requestUrl('http://169.254.169.254/metadata', {
                method: 'GET'
            });

            expect(res.statusCode).toBe(200);
            expect(res.data).toBe('imds-data');

            spy.mockRestore();
        });

        it('should handle request network error', async () => {
            const mockReq = new EventEmitter() as any;
            mockReq.write = jest.fn();
            mockReq.end = jest.fn();

            const spy = (jest.spyOn(https, 'request') as any).mockImplementation((_url: any, _options: any, _callback: any) => {
                process.nextTick(() => {
                    mockReq.emit('error', new Error('Network error'));
                });
                return mockReq;
            });

            await expect(requestUrl('https://example.com', { method: 'GET' })).rejects.toThrow('Network error');

            spy.mockRestore();
        });
    });
});

