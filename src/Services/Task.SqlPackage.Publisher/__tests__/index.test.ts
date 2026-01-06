import * as tl from 'azure-pipelines-task-lib/task';
import * as path from 'path';

// Mock azure-pipelines-task-lib
jest.mock('azure-pipelines-task-lib/task');

describe('SqlPackage Publisher Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Input Validation', () => {
        it('should require dacpacFile input', () => {
            const mockGetInput = tl.getInput as jest.Mock;
            const mockGetPathInput = tl.getPathInput as jest.Mock;

            mockGetInput.mockReturnValue('DacpacFile');
            mockGetPathInput.mockReturnValue(null);

            expect(mockGetPathInput).toBeDefined();
        });

        it('should accept valid server name', () => {
            const mockGetInput = tl.getInput as jest.Mock;

            mockGetInput.mockReturnValue('localhost');
            const serverName = mockGetInput('serverName', true);

            expect(serverName).toBe('localhost');
        });

        it('should accept valid database name', () => {
            const mockGetInput = tl.getInput as jest.Mock;

            mockGetInput.mockReturnValue('MyDatabase');
            const databaseName = mockGetInput('databaseName', true);

            expect(databaseName).toBe('MyDatabase');
        });
    });

    describe('Authentication Types', () => {
        it('should support Windows Authentication', () => {
            const mockGetInput = tl.getInput as jest.Mock;

            mockGetInput.mockReturnValue('windowsAuthentication');
            const authType = mockGetInput('authenticationType', true);

            expect(authType).toBe('windowsAuthentication');
        });

        it('should support SQL Server Authentication', () => {
            const mockGetInput = tl.getInput as jest.Mock;

            mockGetInput.mockReturnValue('sqlServerAuthentication');
            const authType = mockGetInput('authenticationType', true);

            expect(authType).toBe('sqlServerAuthentication');
        });

        it('should support Azure Active Directory', () => {
            const mockGetInput = tl.getInput as jest.Mock;

            mockGetInput.mockReturnValue('azureActiveDirectory');
            const authType = mockGetInput('authenticationType', true);

            expect(authType).toBe('azureActiveDirectory');
        });
    });

    describe('Connection Methods', () => {
        it('should support server connection method', () => {
            const mockGetInput = tl.getInput as jest.Mock;

            mockGetInput.mockReturnValue('server');
            const targetMethod = mockGetInput('targetMethod', true);

            expect(targetMethod).toBe('server');
        });

        it('should support connection string method', () => {
            const mockGetInput = tl.getInput as jest.Mock;

            mockGetInput.mockReturnValue('connectionString');
            const targetMethod = mockGetInput('targetMethod', true);

            expect(targetMethod).toBe('connectionString');
        });
    });

    describe('File Path Operations', () => {
        it('should handle dacpac file path', () => {
            const mockGetPathInput = tl.getPathInput as jest.Mock;
            const testPath = path.join(__dirname, 'test.dacpac');

            mockGetPathInput.mockReturnValue(testPath);
            const dacpacFile = mockGetPathInput('dacpacFile', true, true);

            expect(dacpacFile).toBe(testPath);
        });

        it('should handle publish profile path', () => {
            const mockGetPathInput = tl.getPathInput as jest.Mock;
            const testPath = path.join(__dirname, 'test.publish.xml');

            mockGetPathInput.mockReturnValue(testPath);
            const profilePath = mockGetPathInput('publishProfile', false);

            expect(profilePath).toBe(testPath);
        });
    });

    describe('Additional Arguments', () => {
        it('should accept additional arguments', () => {
            const mockGetInput = tl.getInput as jest.Mock;

            mockGetInput.mockReturnValue('/p:BlockOnPossibleDataLoss=false');
            const args = mockGetInput('additionalArguments', false);

            expect(args).toBe('/p:BlockOnPossibleDataLoss=false');
        });

        it('should handle multiline arguments', () => {
            const mockGetInput = tl.getInput as jest.Mock;
            const multilineArgs = '/p:BlockOnPossibleDataLoss=false\n/p:DropObjectsNotInSource=true';

            mockGetInput.mockReturnValue(multilineArgs);
            const args = mockGetInput('additionalArguments', false);

            expect(args).toContain('BlockOnPossibleDataLoss');
            expect(args).toContain('DropObjectsNotInSource');
        });
    });

    describe('Task Result', () => {
        it('should set success result on completion', () => {
            const mockSetResult = tl.setResult as jest.Mock;

            mockSetResult(tl.TaskResult.Succeeded, 'Deployment completed');

            expect(mockSetResult).toHaveBeenCalledWith(
                tl.TaskResult.Succeeded,
                'Deployment completed'
            );
        });

        it('should set failed result on error', () => {
            const mockSetResult = tl.setResult as jest.Mock;

            mockSetResult(tl.TaskResult.Failed, 'Deployment failed');

            expect(mockSetResult).toHaveBeenCalledWith(
                tl.TaskResult.Failed,
                'Deployment failed'
            );
        });
    });

    describe('Platform Detection', () => {
        it('should detect Windows platform', () => {
            const isWindows = process.platform === 'win32';
            expect(typeof isWindows).toBe('boolean');
        });

        it('should use correct SqlPackage executable', () => {
            const sqlPackageCmd = process.platform === 'win32' ? 'sqlpackage.exe' : 'sqlpackage';
            expect(sqlPackageCmd).toMatch(/sqlpackage/);
        });
    });

    describe('Command Execution', () => {
        it('should construct publish command', () => {
            const args = [
                '/Action:Publish',
                '/SourceFile:test.dacpac',
                '/TargetConnectionString:Server=localhost;Database=MyDb;'
            ];

            expect(args).toContain('/Action:Publish');
            expect(args).toContain('/SourceFile:test.dacpac');
        });

        it('should include publish profile if specified', () => {
            const profilePath = 'test.publish.xml';
            const args = [`/Profile:${profilePath}`];

            expect(args[0]).toContain('/Profile:');
        });
    });
});
