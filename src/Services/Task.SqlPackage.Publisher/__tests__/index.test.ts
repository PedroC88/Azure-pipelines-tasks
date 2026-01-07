// Set test environment BEFORE imports
process.env.NODE_ENV = 'test';

import * as tl from 'azure-pipelines-task-lib/task';
import * as fs from 'fs';
import { run, parseAdditionalArguments } from '../index';

// Mock modules
jest.mock('azure-pipelines-task-lib/task');
jest.mock('fs');

describe('SqlPackage Publisher Tests', () => {
    let mockGetInput: jest.Mock;
    let mockGetPathInput: jest.Mock;
    let mockExec: jest.Mock;
    let mockSetResult: jest.Mock;
    let mockExistsSync: jest.Mock;
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

        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

        // Default successful responses
        mockExec.mockResolvedValue(0);
        mockExistsSync.mockReturnValue(true);
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
                '/TargetDatabaseName:mydb',
                '/TargetTrustServerCertificate:True'
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
            mockExec.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

            await run();

            expect(mockExec).toHaveBeenCalledWith('sqlpackage', expect.arrayContaining([
                '/Profile:/path/to/profile.publish.xml'
            ]));
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
});

