import * as tl from 'azure-pipelines-task-lib/task';
import * as fs from 'fs';
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
