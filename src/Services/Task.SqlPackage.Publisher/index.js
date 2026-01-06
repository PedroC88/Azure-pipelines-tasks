"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = run;
const tl = __importStar(require("azure-pipelines-task-lib/task"));
const fs = __importStar(require("fs"));
async function run() {
    try {
        // Get inputs
        const dacpacFile = tl.getPathInput('dacpacFile', true, true);
        const targetMethod = tl.getInput('targetMethod', true) || 'server';
        const publishProfile = tl.getPathInput('publishProfile', false);
        const additionalArguments = tl.getInput('additionalArguments', false) || '';
        if (!dacpacFile) {
            throw new Error('DACPAC file path is required');
        }
        if (!fs.existsSync(dacpacFile)) {
            throw new Error(`DACPAC file not found: ${dacpacFile}`);
        }
        console.log(`Deploying DACPAC: ${dacpacFile}`);
        // Check if SqlPackage is available
        try {
            await tl.exec('sqlpackage', ['/version']);
        }
        catch (_a) {
            throw new Error('SqlPackage not found in PATH. Please run the SqlPackage Installer task first.');
        }
        // Build SqlPackage arguments
        const args = [];
        // Action
        args.push('/Action:Publish');
        // Source file
        args.push(`/SourceFile:${dacpacFile}`);
        // Target connection
        if (targetMethod === 'server') {
            const serverName = tl.getInput('serverName', true);
            const databaseName = tl.getInput('databaseName', true);
            const authenticationType = tl.getInput('authenticationType', true) || 'windowsAuthentication';
            if (!serverName || !databaseName) {
                throw new Error('Server name and database name are required');
            }
            // Build connection string based on authentication type
            let connectionString = '';
            if (authenticationType === 'windowsAuthentication') {
                connectionString = `Server=${serverName};Database=${databaseName};Integrated Security=True;TrustServerCertificate=True;`;
            }
            else if (authenticationType === 'sqlServerAuthentication') {
                const sqlUsername = tl.getInput('sqlUsername', true);
                const sqlPassword = tl.getInput('sqlPassword', true);
                if (!sqlUsername || !sqlPassword) {
                    throw new Error('SQL username and password are required for SQL Server authentication');
                }
                connectionString = `Server=${serverName};Database=${databaseName};User Id=${sqlUsername};Password=${sqlPassword};TrustServerCertificate=True;`;
            }
            else if (authenticationType === 'azureActiveDirectory') {
                connectionString = `Server=${serverName};Database=${databaseName};Authentication=Active Directory Integrated;TrustServerCertificate=True;`;
            }
            args.push(`/TargetConnectionString:${connectionString}`);
        }
        else if (targetMethod === 'connectionString') {
            const connectionString = tl.getInput('connectionString', true);
            if (!connectionString) {
                throw new Error('Connection string is required');
            }
            args.push(`/TargetConnectionString:${connectionString}`);
        }
        // Publish profile
        if (publishProfile && fs.existsSync(publishProfile)) {
            console.log(`Using publish profile: ${publishProfile}`);
            args.push(`/Profile:${publishProfile}`);
        }
        // Additional arguments
        if (additionalArguments) {
            const additionalArgs = additionalArguments.split(/\r?\n/).filter(arg => arg.trim());
            args.push(...additionalArgs);
        }
        // Execute SqlPackage
        console.log('Executing SqlPackage deployment...');
        console.log(`Command: sqlpackage ${args.join(' ')}`);
        const result = await tl.exec('sqlpackage', args);
        if (result === 0) {
            console.log('Database deployment completed successfully');
            tl.setResult(tl.TaskResult.Succeeded, 'Database deployment completed successfully');
        }
        else {
            throw new Error(`SqlPackage exited with code ${result}`);
        }
    }
    catch (err) {
        const error = err;
        console.error(`Error: ${error.message}`);
        tl.setResult(tl.TaskResult.Failed, error.message);
    }
}
// Only run if not in test mode
if (process.env.NODE_ENV !== 'test') {
    run();
}
//# sourceMappingURL=index.js.map