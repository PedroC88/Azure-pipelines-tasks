import * as tl from 'azure-pipelines-task-lib/task';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

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

export function parseSqlCmdArguments(input: string): string[] {
    const args: string[] = [];
    let current = '';
    let inQuotes = false;
    const normalized = input.split(/\r?\n/).map(line => line.trim()).filter(Boolean).join(' ');

    for (let i = 0; i < normalized.length; i++) {
        const char = normalized[i];
        if (char === '\\' && normalized[i + 1] === '"') {
            current += '"';
            i++;
        } else if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ' ' && !inQuotes) {
            if (current) {
                args.push(current);
                current = '';
            }
        } else {
            current += char;
        }
    }

    if (inQuotes) {
        throw new Error('SQLCMD arguments contain an unmatched double quote.');
    }
    if (current) {
        args.push(current);
    }
    return args;
}

interface SqlConnectionDetails {
    server?: string;
    database?: string;
    username?: string;
    password?: string;
    authentication?: string;
    encrypt?: string;
    loginTimeout?: string;
    integratedSecurity?: boolean;
    trustServerCertificate?: boolean;
}

export function parseSqlConnectionString(connectionString: string): SqlConnectionDetails {
    const values: Record<string, string> = {};
    let position = 0;

    while (position < connectionString.length) {
        while (connectionString[position] === ';' || /\s/.test(connectionString[position] || '')) {
            position++;
        }
        if (position >= connectionString.length) {
            break;
        }

        const equalsIndex = connectionString.indexOf('=', position);
        if (equalsIndex < 0) {
            throw new Error('Invalid SQL connection string: a key/value pair is missing "=".');
        }

        const key = connectionString.slice(position, equalsIndex).trim().toLowerCase();
        position = equalsIndex + 1;
        let value = '';
        const opening = connectionString[position];

        if (opening === '{') {
            position++;
            let closed = false;
            while (position < connectionString.length) {
                if (connectionString[position] === '}' && connectionString[position + 1] === '}') {
                    value += '}';
                    position += 2;
                } else if (connectionString[position] === '}') {
                    position++;
                    closed = true;
                    break;
                } else {
                    value += connectionString[position++];
                }
            }
            if (!closed) {
                throw new Error('Invalid SQL connection string: a braced value is not closed.');
            }
        } else if (opening === '"' || opening === '\'') {
            position++;
            while (position < connectionString.length && connectionString[position] !== opening) {
                value += connectionString[position++];
            }
            if (connectionString[position] !== opening) {
                throw new Error('Invalid SQL connection string: a quoted value is not closed.');
            }
            position++;
        } else {
            const separator = connectionString.indexOf(';', position);
            value = connectionString.slice(position, separator < 0 ? undefined : separator).trim();
            position = separator < 0 ? connectionString.length : separator;
        }

        if (connectionString[position] === ';') {
            position++;
        }
        if (key) {
            values[key] = value;
        }
    }

    const getValue = (...keys: string[]): string | undefined => {
        for (const key of keys) {
            if (values[key] !== undefined) {
                return values[key];
            }
        }
        return undefined;
    };

    const supportedKeys = new Set([
        'server', 'data source', 'address', 'addr', 'network address',
        'database', 'initial catalog',
        'user id', 'uid', 'user',
        'password', 'pwd',
        'authentication',
        'integrated security', 'trusted_connection',
        'trustservercertificate',
        'encrypt',
        'connect timeout', 'connection timeout', 'login timeout'
    ]);
    const unsupportedKeys = Object.keys(values).filter(key => !supportedKeys.has(key));
    if (unsupportedKeys.length > 0) {
        throw new Error(`SQL connection string options are not supported by sqlcmd: ${unsupportedKeys.join(', ')}.`);
    }

    const integratedSecurity = getValue('integrated security', 'trusted_connection');
    const trustServerCertificate = getValue('trustservercertificate');
    const encrypt = getValue('encrypt');

    return {
        server: getValue('server', 'data source', 'address', 'addr', 'network address'),
        database: getValue('database', 'initial catalog'),
        username: getValue('user id', 'uid', 'user'),
        password: getValue('password', 'pwd'),
        authentication: getValue('authentication'),
        encrypt,
        loginTimeout: getValue('connect timeout', 'connection timeout', 'login timeout'),
        integratedSecurity: ['true', 'yes', 'sspi'].includes(integratedSecurity?.toLowerCase() || ''),
        trustServerCertificate: ['true', 'yes'].includes(trustServerCertificate?.toLowerCase() || '')
    };
}

export function getSqlResourceForServer(serverName?: string): { resource: string; scope: string } {
    if (serverName) {
        const lower = serverName.toLowerCase();
        if (lower.includes('.database.usgovcloudapi.net')) {
            return {
                resource: 'https://database.usgovcloudapi.net',
                scope: 'https://database.usgovcloudapi.net/.default'
            };
        }
        if (lower.includes('.database.chinacloudapi.cn')) {
            return {
                resource: 'https://database.chinacloudapi.cn',
                scope: 'https://database.chinacloudapi.cn/.default'
            };
        }
    }
    return {
        resource: 'https://database.windows.net',
        scope: 'https://database.windows.net/.default'
    };
}

export function requestUrl(
    url: string,
    options: {
        method: string;
        headers?: Record<string, string>;
        body?: string;
    }
): Promise<{ statusCode: number; data: string }> {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const protocol = parsedUrl.protocol === 'http:' ? http : https;

        const req = protocol.request(url, {
            method: options.method,
            headers: options.headers
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode || 200,
                    data
                });
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        if (options.body) {
            req.write(options.body);
        }
        req.end();
    });
}

export async function getEntraAccessToken(serviceConnection: string, serverName?: string): Promise<string> {
    const endpointAuth = tl.getEndpointAuthorization(serviceConnection, true);
    const authScheme = tl.getEndpointAuthorizationScheme(serviceConnection, true) || endpointAuth?.scheme;

    // Check direct access token first
    const directAccessToken = tl.getEndpointAuthorizationParameter(serviceConnection, 'AccessToken', true) ||
        tl.getEndpointAuthorizationParameter(serviceConnection, 'accesstoken', true) ||
        endpointAuth?.parameters?.['AccessToken'] ||
        endpointAuth?.parameters?.['accesstoken'];

    if (directAccessToken) {
        tl.setSecret(directAccessToken);
        return directAccessToken;
    }

    const { resource, scope } = getSqlResourceForServer(serverName);

    // Managed Identity
    if (authScheme === 'ManagedServiceIdentity') {
        const imdsUrl = `http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=${encodeURIComponent(resource)}`;
        const response = await requestUrl(imdsUrl, {
            method: 'GET',
            headers: {
                'Metadata': 'true'
            }
        });

        if (response.statusCode < 200 || response.statusCode >= 300) {
            let errorDetail = response.data;
            try {
                const parsed = JSON.parse(response.data);
                errorDetail = parsed.error_description || parsed.error || response.data;
            } catch {
                // use raw data
            }
            throw new Error(`Failed to acquire Microsoft Entra ID token from Managed Identity (HTTP ${response.statusCode}): ${errorDetail}`);
        }

        const tokenData = JSON.parse(response.data);
        if (!tokenData.access_token) {
            throw new Error('Managed Identity response did not contain access_token');
        }

        tl.setSecret(tokenData.access_token);
        return tokenData.access_token;
    }

    // Tenant ID and Client ID / Service Principal ID
    const tenantId = tl.getEndpointAuthorizationParameter(serviceConnection, 'tenantid', true) ||
        tl.getEndpointDataParameter(serviceConnection, 'tenantid', true) ||
        endpointAuth?.parameters?.['tenantid'];

    const servicePrincipalId = tl.getEndpointAuthorizationParameter(serviceConnection, 'serviceprincipalid', true) ||
        tl.getEndpointDataParameter(serviceConnection, 'serviceprincipalid', true) ||
        endpointAuth?.parameters?.['serviceprincipalid'];

    const servicePrincipalKey = tl.getEndpointAuthorizationParameter(serviceConnection, 'serviceprincipalkey', true) ||
        endpointAuth?.parameters?.['serviceprincipalkey'];

    const federatedToken = tl.getEndpointAuthorizationParameter(serviceConnection, 'federatedToken', true) ||
        tl.getEndpointAuthorizationParameter(serviceConnection, 'workloadIdentityFederationToken', true) ||
        endpointAuth?.parameters?.['federatedToken'] ||
        endpointAuth?.parameters?.['workloadIdentityFederationToken'] ||
        (authScheme === 'WorkloadIdentityFederation' ? process.env['AZURE_FEDERATED_TOKEN'] || process.env['SYSTEM_ACCESSTOKEN'] : undefined);

    let authorityUrl = tl.getEndpointDataParameter(serviceConnection, 'environmentAuthorityUrl', true) ||
        tl.getEndpointDataParameter(serviceConnection, 'activeDirectoryAuthority', true) ||
        'https://login.microsoftonline.com/';

    if (!authorityUrl.endsWith('/')) {
        authorityUrl += '/';
    }

    if (!tenantId || !servicePrincipalId) {
        throw new Error(`Service connection "${serviceConnection}" is missing tenant ID or service principal ID.`);
    }

    const tokenEndpoint = `${authorityUrl}${tenantId}/oauth2/v2.0/token`;
    let postBody = '';

    if (federatedToken) {
        // Workload Identity Federation (OIDC / Federated Token)
        postBody = [
            'grant_type=client_credentials',
            `client_id=${encodeURIComponent(servicePrincipalId)}`,
            `client_assertion_type=${encodeURIComponent('urn:ietf:params:oauth:client-assertion-type:jwt-bearer')}`,
            `client_assertion=${encodeURIComponent(federatedToken)}`,
            `scope=${encodeURIComponent(scope)}`
        ].join('&');
    } else if (servicePrincipalKey) {
        // Service Principal with Client Secret
        postBody = [
            'grant_type=client_credentials',
            `client_id=${encodeURIComponent(servicePrincipalId)}`,
            `client_secret=${encodeURIComponent(servicePrincipalKey)}`,
            `scope=${encodeURIComponent(scope)}`
        ].join('&');
    } else {
        throw new Error(`Unable to authenticate with service connection "${serviceConnection}". Could not find valid credentials (service principal key, federated token, or managed identity).`);
    }

    const response = await requestUrl(tokenEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postBody).toString()
        },
        body: postBody
    });

    if (response.statusCode < 200 || response.statusCode >= 300) {
        let errorDetail = response.data;
        try {
            const parsed = JSON.parse(response.data);
            errorDetail = parsed.error_description || parsed.error || response.data;
        } catch {
            // use raw data
        }
        throw new Error(`Failed to acquire Microsoft Entra ID access token from "${tokenEndpoint}" (HTTP ${response.statusCode}): ${errorDetail}`);
    }

    const tokenData = JSON.parse(response.data);
    if (!tokenData.access_token) {
        throw new Error('Token endpoint response did not contain access_token');
    }

    tl.setSecret(tokenData.access_token);
    return tokenData.access_token;
}

function getServicePrincipalId(serviceConnection: string): string | undefined {
    const endpointAuth = tl.getEndpointAuthorization(serviceConnection, true);
    return tl.getEndpointAuthorizationParameter(serviceConnection, 'serviceprincipalid', true) ||
        tl.getEndpointDataParameter(serviceConnection, 'serviceprincipalid', true) ||
        endpointAuth?.parameters?.['serviceprincipalid'];
}

async function addSqlCmdAuthentication(
    args: string[],
    environment: NodeJS.ProcessEnv,
    authenticationType: string,
    serverName: string,
    targetMethod: string
): Promise<void> {
    delete environment.SQLCMDPASSWORD;
    delete environment.SQLCMDUSER;

    if (targetMethod === 'connectionString') {
        const connectionString = tl.getInput('connectionString', true);
        if (!connectionString) {
            throw new Error('Connection string is required');
        }
        const details = parseSqlConnectionString(connectionString);
        if (!details.server || !details.database) {
            throw new Error('The SQL connection string must include a server and database.');
        }

        args.push('-S', details.server, '-d', details.database);
        if (details.trustServerCertificate) {
            args.push('-C');
        }
        if (details.encrypt) {
            const encrypt = details.encrypt.toLowerCase();
            const encryptionMode = ['true', 'yes'].includes(encrypt)
                ? 'mandatory'
                : ['false', 'no'].includes(encrypt) ? 'optional' : encrypt;
            args.push('-N', encryptionMode);
        }
        if (details.loginTimeout) {
            args.push('-l', details.loginTimeout);
        }

        const authMethod = details.authentication?.toLowerCase() || '';
        if (authMethod.includes('active directory')) {
            if (authMethod.includes('password')) {
                if (!details.username || !details.password) {
                    throw new Error('The connection string must include a user ID and password for Active Directory Password authentication.');
                }
                args.push('-G', '-U', details.username);
                tl.setSecret(details.password);
                environment.SQLCMDPASSWORD = details.password;
            } else if (authMethod.includes('service principal')) {
                if (!details.username || !details.password) {
                    throw new Error('The connection string must include a client ID and password for Active Directory Service Principal authentication.');
                }
                args.push('--authentication-method', 'ActiveDirectoryServicePrincipal', '-U', details.username);
                tl.setSecret(details.password);
                environment.SQLCMDPASSWORD = details.password;
            } else if (authMethod.includes('managed identity')) {
                args.push('--authentication-method', 'ActiveDirectoryManagedIdentity');
                if (details.username) {
                    args.push('-U', details.username);
                }
            } else {
                args.push('-G');
                if (details.username) {
                    args.push('-U', details.username);
                }
                if (details.password !== undefined) {
                    tl.setSecret(details.password);
                    environment.SQLCMDPASSWORD = details.password;
                }
            }
        } else if (details.integratedSecurity) {
            args.push('-E');
        } else if (details.username) {
            if (details.password === undefined) {
                throw new Error('The SQL connection string must include a password when a user ID is specified.');
            }
            args.push('-U', details.username);
            tl.setSecret(details.password);
            environment.SQLCMDPASSWORD = details.password;
        } else {
            throw new Error('The SQL connection string must specify SQL credentials, integrated security, or an Active Directory authentication method.');
        }
        return;
    }

    if (targetMethod !== 'server') {
        throw new Error(`Unsupported target connection method: ${targetMethod}`);
    }

    const databaseName = tl.getInput('databaseName', true);
    if (!serverName || !databaseName) {
        throw new Error('Server name and database name are required');
    }
    args.push('-S', serverName, '-d', databaseName);

    if (authenticationType === 'windowsAuthentication') {
        args.push('-E');
    } else if (authenticationType === 'sqlServerAuthentication') {
        const sqlUsername = tl.getInput('sqlUsername', true);
        const sqlPassword = tl.getInput('sqlPassword', true);
        if (!sqlUsername || !sqlPassword) {
            throw new Error('SQL username and password are required for SQL Server authentication');
        }
        args.push('-U', sqlUsername);
        tl.setSecret(sqlPassword);
        environment.SQLCMDPASSWORD = sqlPassword;
    } else if (authenticationType === 'azureActiveDirectory') {
        args.push('-G');
    } else if (authenticationType === 'entraIntegrated') {
        const azureSubscription = tl.getInput('azureSubscription', false) ||
            tl.getInput('azureServiceConnection', false) ||
            tl.getInput('connectedServiceName', false);
        if (!azureSubscription) {
            throw new Error('Azure Subscription / Service Connection is required for Entra Integrated authentication');
        }

        const authScheme = tl.getEndpointAuthorizationScheme(azureSubscription, true) ||
            tl.getEndpointAuthorization(azureSubscription, true)?.scheme;
        if (authScheme === 'ManagedServiceIdentity') {
            args.push('--authentication-method', 'ActiveDirectoryManagedIdentity');
            const managedIdentityClientId =
                tl.getEndpointAuthorizationParameter(azureSubscription, 'clientId', true) ||
                tl.getEndpointAuthorizationParameter(azureSubscription, 'clientid', true) ||
                tl.getEndpointDataParameter(azureSubscription, 'clientId', true);
            if (managedIdentityClientId) {
                args.push('-U', managedIdentityClientId);
            }
            return;
        }

        const servicePrincipalId = getServicePrincipalId(azureSubscription);
        if (!servicePrincipalId) {
            throw new Error('The service connection must provide a service principal ID to authenticate sqlcmd with Entra ID.');
        }

        const accessToken = await getEntraAccessToken(azureSubscription, serverName);
        args.push('--authentication-method', 'ActiveDirectoryServicePrincipalAccessToken', '-U', servicePrincipalId);
        environment.SQLCMDPASSWORD = accessToken;
    } else {
        throw new Error(`Unsupported authentication type: ${authenticationType}`);
    }
}

export async function run() {
    try {
        // Get inputs
        // Agents resolve an empty filePath input (even a hidden one) to the sources directory,
        // so dacpacFile cannot be used to detect DACPAC mode: an explicit script selection wins.
        const requestedTaskType = tl.getInput('taskNameSelector', false);
        const taskNameSelector = requestedTaskType === 'SqlTask' || requestedTaskType === 'InlineSqlTask'
            ? requestedTaskType
            : 'DacpacTask';
        const dacpacFile = tl.getPathInput('dacpacFile', false, true);
        const targetMethod = tl.getInput('targetMethod', true) || 'server';
        const publishProfile = tl.getPathInput('publishProfile', false);
        const additionalArguments = tl.getInput('additionalArguments', false) || '';

        if (taskNameSelector === 'SqlTask' || taskNameSelector === 'InlineSqlTask') {
            const serverName = targetMethod === 'server' ? tl.getInput('serverName', false) || '' : '';
            const authenticationType = tl.getInput('authenticationType', false) || 'windowsAuthentication';
            const scriptPattern = taskNameSelector === 'SqlTask' ? tl.getPathInput('sqlFile', true, false) : '';
            const inlineSql = taskNameSelector === 'InlineSqlTask' ? tl.getInput('sqlInline', false) || '' : '';
            const scriptArguments = tl.getInput(
                taskNameSelector === 'SqlTask' ? 'sqlAdditionalArguments' : 'inlineAdditionalArguments',
                false
            ) || '';

            let inputFile = '';
            let scriptPath = '';
            let temporaryDirectory: string | undefined;
            try {
                if (taskNameSelector === 'SqlTask') {
                    if (!scriptPattern) {
                        throw new Error('SQL script file path is required');
                    }
                    const matches = tl.findMatch(
                        tl.getVariable('System.DefaultWorkingDirectory') || process.cwd(),
                        scriptPattern
                    );
                    if (matches.length === 0) {
                        throw new Error(`No SQL script files matched: ${scriptPattern}`);
                    }
                    if (matches.length > 1) {
                        throw new Error(`More than one SQL script file matched: ${scriptPattern}`);
                    }
                    scriptPath = matches[0];
                    if (!fs.existsSync(scriptPath) || !fs.statSync(scriptPath).isFile()) {
                        throw new Error(`SQL script file not found: ${scriptPath}`);
                    }
                    if (path.extname(scriptPath).toLowerCase() !== '.sql') {
                        throw new Error(`SQL script file must have a .sql extension: ${scriptPath}`);
                    }
                    inputFile = scriptPath;
                } else {
                    if (!inlineSql.trim()) {
                        throw new Error('Inline SQL script is required');
                    }
                    temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'sqlpackage-publisher-'));
                    inputFile = path.join(temporaryDirectory, 'inline.sql');
                    fs.writeFileSync(inputFile, inlineSql, 'utf8');
                }

                const environment: NodeJS.ProcessEnv = { ...process.env };
                const args: string[] = ['-b'];
                await addSqlCmdAuthentication(args, environment, authenticationType, serverName, targetMethod);
                args.push('-i', inputFile);
                args.push(...parseSqlCmdArguments(scriptArguments));

                try {
                    await tl.exec('sqlcmd', ['--version']);
                } catch {
                    throw new Error('SqlCmd not found in PATH. Please run the SqlCmd Installer task first.');
                }

                console.log(taskNameSelector === 'SqlTask'
                    ? `Executing SQL script file: ${scriptPath}`
                    : 'Executing inline SQL script...');
                const result = await tl.exec('sqlcmd', args, { env: environment });
                if (result !== 0) {
                    throw new Error(`SqlCmd exited with code ${result}`);
                }

                console.log('SQL script completed successfully');
                tl.setResult(tl.TaskResult.Succeeded, 'SQL script completed successfully');
            } finally {
                if (temporaryDirectory) {
                    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
                }
            }
            return;
        }

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
            } else if (authenticationType === 'entraIntegrated') {
                const azureSubscription = tl.getInput('azureSubscription', false) ||
                    tl.getInput('azureServiceConnection', false) ||
                    tl.getInput('connectedServiceName', false);

                if (!azureSubscription) {
                    throw new Error('Azure Subscription / Service Connection is required for Entra Integrated authentication');
                }

                console.log(`Acquiring Microsoft Entra ID access token for service connection: ${azureSubscription}`);
                const accessToken = await getEntraAccessToken(azureSubscription, serverName);
                args.push(`/AccessToken:${accessToken}`);
            }

        } else if (targetMethod === 'connectionString') {
            const connectionString = tl.getInput('connectionString', true);

            if (!connectionString) {
                throw new Error('Connection string is required');
            }

            args.push(`/TargetConnectionString:${connectionString}`);
        }

        // Publish profile - only add if a value is provided and it's a valid file
        if (publishProfile) {
            const trimmedProfile = publishProfile.trim();
            if (trimmedProfile !== '') {
                // Value was provided, now validate it's a file
                if (fs.existsSync(trimmedProfile) && fs.statSync(trimmedProfile).isFile()) {
                    console.log(`Using publish profile: ${trimmedProfile}`);
                    args.push(`/Profile:${trimmedProfile}`);
                }
            }
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
