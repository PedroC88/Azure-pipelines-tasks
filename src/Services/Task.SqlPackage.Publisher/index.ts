import * as tl from 'azure-pipelines-task-lib/task';
import * as fs from 'fs';

export function parseAdditionalArguments(input: string): string[] {
    const args: string[] = [];
    let current = '';
    let inQuotes = false;

    // Normalize line endings and split into lines
    const lines = input.split(/\r?\n/);

    // Join all lines with spaces, but preserve intentional newlines as boundaries
    const normalized = lines.map(line => line.trim()).filter(line => line).join(' ');

    for (let i = 0; i < normalized.length; i++) {
        const char = normalized[i];

        // Handle escaped quotes
        if (char === '\\' && i + 1 < normalized.length && normalized[i + 1] === '"') {
            // Add the quote to current without toggling inQuotes state
            current += '"';
            i++; // Skip the next character (the quote)
            continue;
        }

        // Handle quote delimiters
        if (char === '"') {
            inQuotes = !inQuotes;
            current += char;
            continue;
        }

        // Handle spaces (argument separators when not in quotes)
        if (char === ' ' && !inQuotes) {
            if (current.length > 0) {
                args.push(current);
                current = '';
            }
            continue;
        }

        current += char;
    }

    // Add final argument if exists
    if (current.length > 0) {
        args.push(current);
    }

    return args;
}

export async function run() {
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
        } catch {
            throw new Error('SqlPackage not found in PATH. Please run the SqlPackage Installer task first.');
        }

        // Build SqlPackage arguments
        const args: string[] = [];

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

            // Use individual target parameters instead of connection string
            // This allows additional target parameters to be used without conflicts
            args.push(`/TargetServerName:${serverName}`);
            args.push(`/TargetDatabaseName:${databaseName}`);

            if (authenticationType === 'windowsAuthentication') {
                // Integrated security doesn't need username/password
                // SqlPackage will use Windows authentication by default when no credentials provided
            } else if (authenticationType === 'sqlServerAuthentication') {
                const sqlUsername = tl.getInput('sqlUsername', true);
                const sqlPassword = tl.getInput('sqlPassword', true);

                if (!sqlUsername || !sqlPassword) {
                    throw new Error('SQL username and password are required for SQL Server authentication');
                }

                args.push(`/TargetUser:${sqlUsername}`);
                args.push(`/TargetPassword:${sqlPassword}`);
            } else if (authenticationType === 'azureActiveDirectory') {
                // Azure AD authentication
                args.push('/TargetAuthenticationType:ActiveDirectoryIntegrated');
            }

        } else if (targetMethod === 'connectionString') {
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
            // Parse additional arguments - handle both space-separated and newline-separated
            // Need to handle quoted values properly (e.g., /v:Var="Value with spaces")
            const additionalArgs = parseAdditionalArguments(additionalArguments);
            args.push(...additionalArgs);
        }

        // Execute SqlPackage
        console.log('Executing SqlPackage deployment...');
        console.log(`Command: sqlpackage ${args.join(' ')}`);

        const result = await tl.exec('sqlpackage', args);

        if (result === 0) {
            console.log('Database deployment completed successfully');
            tl.setResult(tl.TaskResult.Succeeded, 'Database deployment completed successfully');
        } else {
            throw new Error(`SqlPackage exited with code ${result}`);
        }

    } catch (err) {
        const error = err as Error;
        console.error(`Error: ${error.message}`);
        tl.setResult(tl.TaskResult.Failed, error.message);
    }
}

// Only run if not in test mode
if (process.env.NODE_ENV !== 'test') {
    run();
}
