import * as tl from 'azure-pipelines-task-lib/task';
import * as tr from 'azure-pipelines-tool-lib/tool';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

const toolName = 'SqlPackage';

// SqlPackage download URLs - Direct links to zip packages
const downloadUrls: { [key: string]: string } = {
    'win32': 'https://aka.ms/sqlpackage-windows', // Windows x64 zip
    'linux': 'https://aka.ms/sqlpackage-linux', // Linux x64 zip
    'darwin': 'https://aka.ms/sqlpackage-macos'  // macOS x64 zip
};

interface SqlPackageVersion {
    version: string;
    downloadUrl: string;
    fileName: string;
}

async function getAvailableVersions(): Promise<SqlPackageVersion[]> {
    const isDebug = tl.getVariable('System.Debug') === 'true';

    try {
        if (isDebug) console.log('Attempting to fetch versions from GitHub API...');
        const response = await tr.downloadTool('https://api.github.com/repos/microsoft/DacFx/releases');
        const content = fs.readFileSync(response, 'utf8');
        const releases = JSON.parse(content);

        if (isDebug) console.log(`Found ${releases.length} releases from GitHub API`);
        const versions: SqlPackageVersion[] = [];

        for (const release of releases) {
            if (!release.prerelease && release.assets && release.assets.length > 0) {
                const platform = getPlatform();
                const asset = findAssetForPlatform(release.assets, platform);

                if (asset) {
                    versions.push({
                        version: release.tag_name.replace('v', ''),
                        downloadUrl: asset.browser_download_url,
                        fileName: asset.name
                    });
                }
            }
        }

        if (isDebug) console.log(`Found ${versions.length} compatible versions from GitHub`);

        // If we found versions from GitHub, return them
        if (versions.length > 0) {
            return versions;
        }

        if (isDebug) console.log('No compatible versions found from GitHub, falling back to default versions');
        return getDefaultVersions();
    } catch (error) {
        if (isDebug) {
            console.log(`Failed to get versions from GitHub releases: ${error}`);
            console.log('Falling back to default versions');
        }
        return getDefaultVersions();
    }
}

interface GitHubAsset {
    name: string;
    browser_download_url: string;
}

function findAssetForPlatform(assets: GitHubAsset[], platform: string): GitHubAsset | undefined {
    const platformKeywords: { [key: string]: string[] } = {
        'win32': ['win', 'windows'],
        'linux': ['linux'],
        'darwin': ['osx', 'mac', 'darwin']
    };

    const keywords = platformKeywords[platform] || [];

    for (const asset of assets) {
        const name = asset.name.toLowerCase();
        if (keywords.some(keyword => name.includes(keyword))) {
            return asset;
        }
    }

    return undefined;
}

function getDefaultVersions(): SqlPackageVersion[] {
    const platform = getPlatform();
    const downloadUrl = downloadUrls[platform];

    if (!downloadUrl) {
        throw new Error(`Unsupported platform: ${platform}`);
    }

    const isDebug = tl.getVariable('System.Debug') === 'true';
    if (isDebug) console.log(`Using default SqlPackage version for platform: ${platform}`);

    return [
        {
            version: '170.2.70.1', // Updated to current latest version
            downloadUrl: downloadUrl,
            fileName: getFileNameForPlatform(platform)
        }
    ];
}

function getFileNameForPlatform(platform: string): string {
    switch (platform) {
        case 'win32':
            return 'sqlpackage-win-x64.zip';
        case 'linux':
            return 'sqlpackage-linux-x64.zip';
        case 'darwin':
            return 'sqlpackage-osx-x64.zip';
        default:
            throw new Error(`Unsupported platform: ${platform}`);
    }
}

function getPlatform(): string {
    return os.platform();
}

function getArch(): string {
    return os.arch();
}

function findMatchingVersion(versions: SqlPackageVersion[], versionSpec: string): SqlPackageVersion | undefined {
    const isDebug = tl.getVariable('System.Debug') === 'true';

    if (versionSpec === 'latest') {
        return versions[0]; // First version is the latest
    }

    // Parse the version spec (e.g., "162", "162.0", "162.0.52")
    const specParts = versionSpec.split('.');

    if (isDebug) console.log(`Searching for versions matching spec: ${versionSpec}`);

    // Find all versions that match the specified parts
    const matches = versions.filter(v => {
        const versionParts = v.version.split('.');

        // Check if all specified parts match
        for (let i = 0; i < specParts.length; i++) {
            if (versionParts[i] !== specParts[i]) {
                return false;
            }
        }
        return true;
    });

    if (matches.length === 0) {
        if (isDebug) console.log(`No versions found matching: ${versionSpec}`);
        return undefined;
    }

    // Return the latest (first) matching version
    const matched = matches[0];
    if (isDebug) console.log(`Found matching version: ${matched.version}`);
    return matched;
}

function findCachedVersionMatchingSpec(versionSpec: string, arch: string): string {
    const isDebug = tl.getVariable('System.Debug') === 'true';

    if (versionSpec === 'latest') {
        // For 'latest', only check for exact 'latest' in cache
        return tr.findLocalTool(toolName, 'latest', arch);
    }

    // For partial version specs, we need to find any cached version that matches
    // Azure Pipelines caches tools in: <agent>/_work/_tool/<toolName>/<version>/<arch>
    // We'll try to find all versions by checking progressively more specific versions

    const specParts = versionSpec.split('.');

    // Try exact match first (e.g., "170.2.70" matches "170.2.70")
    let toolPath = tr.findLocalTool(toolName, versionSpec, arch);
    if (toolPath) {
        if (isDebug) console.log(`Found exact cache match: ${versionSpec}`);
        return toolPath;
    }

    // For partial specs, we need to search for matching versions
    // Try to find any version matching the partial spec
    // E.g., for "170.2", we want to find "170.2.70", "170.2.71", etc.

    // We can search by trying progressively more specific version patterns
    // The Azure Pipelines tool cache doesn't provide a way to list all versions,
    // so we'll try common patch versions (0-100)
    for (let patch = 0; patch < 100; patch++) {
        let testVersion: string;
        if (specParts.length === 1) {
            // Major only: try major.minor.patch
            for (let minor = 0; minor < 20; minor++) {
                testVersion = `${specParts[0]}.${minor}.${patch}`;
                toolPath = tr.findLocalTool(toolName, testVersion, arch);
                if (toolPath) {
                    if (isDebug) console.log(`Found cached version matching spec: ${testVersion}`);
                    return toolPath;
                }
            }
        } else if (specParts.length === 2) {
            // Major.Minor: try major.minor.patch
            testVersion = `${specParts[0]}.${specParts[1]}.${patch}`;
            toolPath = tr.findLocalTool(toolName, testVersion, arch);
            if (toolPath) {
                if (isDebug) console.log(`Found cached version matching spec: ${testVersion}`);
                return toolPath;
            }
        }
    }

    return '';
}

async function acquireSqlPackage(versionSpec: string, checkLatest: boolean): Promise<string> {
    const platform = getPlatform();
    const arch = getArch();
    const isDebug = tl.getVariable('System.Debug') === 'true';

    if (!checkLatest) {
        // Scenario 1: Check cache first for any matching version
        const cachedPath = findCachedVersionMatchingSpec(versionSpec, arch);
        if (cachedPath) {
            console.log(`SqlPackage version matching '${versionSpec}' is already cached at: ${cachedPath}`);
            return cachedPath;
        }
    }

    // Fetch available versions from GitHub to resolve the latest matching version
    console.log(`Fetching available SqlPackage versions...`);
    const versions = await getAvailableVersions();

    if (versions.length === 0) {
        throw new Error('No SqlPackage versions available. Unable to download from GitHub releases.');
    }

    if (isDebug) {
        console.log(`Available versions: ${versions.map(v => v.version).slice(0, 10).join(', ')}${versions.length > 10 ? '...' : ''}`);
    }

    // Find the matching version (latest that matches the spec)
    const matchedVersion = findMatchingVersion(versions, versionSpec);

    if (!matchedVersion) {
        const availableVersions = versions.map(v => v.version).slice(0, 5).join(', ');
        throw new Error(`No SqlPackage version matching '${versionSpec}' found. Available versions include: ${availableVersions}...`);
    }

    const resolvedVersion = matchedVersion.version;
    const downloadUrl = matchedVersion.downloadUrl;

    console.log(`Resolved version: ${resolvedVersion}`);

    // Scenario 2: If checkLatest=true, we've now resolved the latest version
    // Check if this specific resolved version is cached
    const resolvedSemver = resolvedVersion.split('.').slice(0, 3).join('.');
    let toolPath = tr.findLocalTool(toolName, resolvedSemver, arch);

    if (toolPath) {
        console.log(`SqlPackage version ${resolvedVersion} is already cached at: ${toolPath}`);
        return toolPath;
    }

    // Not in cache, need to download
    console.log(`Download URL: ${downloadUrl}`);

    // Download
    console.log(`Downloading SqlPackage version ${resolvedVersion}...`);
    console.log(`From: ${downloadUrl}`);
    const downloadPath = await tr.downloadTool(downloadUrl);
    if (isDebug) console.log(`Downloaded to: ${downloadPath}`);
    console.log('Extracting downloaded package...');

    // Extract - prefer ZIP extraction for better compatibility with Docker containers
    let extractedPath: string;
    try {
        // SqlPackage downloads are always ZIP files, even if the URL doesn't show .zip extension
        if (isDebug) console.log('Extracting as ZIP file...');
        extractedPath = await tr.extractZip(downloadPath);
        if (isDebug) console.log(`Successfully extracted to: ${extractedPath}`);
    } catch (extractError) {
        if (isDebug) console.log(`ZIP extraction failed: ${extractError}`);
        // Only try 7z as fallback if ZIP fails
        try {
            if (isDebug) console.log('Retrying with 7z extraction...');
            extractedPath = await tr.extract7z(downloadPath);
            if (isDebug) console.log(`Successfully extracted with 7z to: ${extractedPath}`);
        } catch (retryError) {
            throw new Error(`Failed to extract downloaded package. ZIP extraction failed: ${extractError}. 7z extraction also failed: ${retryError}`);
        }
    }

    // Find the SqlPackage executable
    const sqlPackagePath = await findSqlPackageExecutable(extractedPath);

    if (!sqlPackagePath) {
        throw new Error('SqlPackage executable not found in extracted package');
    }

    // Cache the tool
    const semverVersion = resolvedVersion.split('.').slice(0, 3).join('.');
    if (isDebug) {
        console.log(`Caching tool with version: ${resolvedVersion} (semver: ${semverVersion})`);
        const sqlPackageDir = path.dirname(sqlPackagePath);
        console.log(`SqlPackage executable path: ${sqlPackagePath}`);
        console.log(`SqlPackage directory for caching: ${sqlPackageDir}`);
        console.log(`Cache parameters: toolName=${toolName}, version=${semverVersion}, arch=${arch}`);
    }
    console.log(`Caching SqlPackage version ${resolvedVersion}...`);
    const sqlPackageDir = path.dirname(sqlPackagePath);
    toolPath = await tr.cacheDir(sqlPackageDir, toolName, semverVersion, arch);

    console.log(`SqlPackage version ${resolvedVersion} has been cached and is ready at: ${toolPath}`);

    return toolPath;
}

async function findSqlPackageExecutable(rootPath: string): Promise<string | null> {
    const isDebug = tl.getVariable('System.Debug') === 'true';
    const platform = getPlatform();
    const executableName = platform === 'win32' ? 'sqlpackage.exe' : 'sqlpackage';

    if (isDebug) console.log(`Searching for ${executableName} in extracted directory: ${rootPath}`);

    // List contents of root directory for debugging
    if (isDebug && fs.existsSync(rootPath)) {
        const rootContents = fs.readdirSync(rootPath);
        console.log(`Root directory contents: ${rootContents.join(', ')}`);
    }

    // Common paths where SqlPackage might be located
    const searchPaths = [
        rootPath,
        path.join(rootPath, 'sqlpackage'),
        path.join(rootPath, 'tools'),
        path.join(rootPath, 'bin'),
        path.join(rootPath, 'SqlPackage'),
        path.join(rootPath, 'SqlPackage', 'bin'),
        path.join(rootPath, 'SqlPackage', 'tools')
    ];

    // First, try direct paths
    for (const searchPath of searchPaths) {
        const executablePath = path.join(searchPath, executableName);
        if (isDebug) console.log(`Checking path: ${executablePath}`);
        if (fs.existsSync(executablePath)) {
            if (isDebug) console.log(`Found SqlPackage executable at: ${executablePath}`);
            // Make sure it's executable on Unix systems
            if (platform !== 'win32') {
                fs.chmodSync(executablePath, '755');
            }
            return executablePath;
        }
    }

    // Then, recursively search subdirectories
    for (const searchPath of searchPaths) {
        if (fs.existsSync(searchPath) && fs.statSync(searchPath).isDirectory()) {
            const result = await searchDirectoryRecursively(searchPath, executableName, platform, isDebug);
            if (result) {
                if (isDebug) console.log(`Found SqlPackage executable recursively at: ${result}`);
                return result;
            }
        }
    }

    if (isDebug) console.log(`SqlPackage executable '${executableName}' not found in any expected location`);
    return null;
}

async function searchDirectoryRecursively(dirPath: string, executableName: string, platform: string, isDebug: boolean): Promise<string | null> {
    try {
        const files = fs.readdirSync(dirPath);

        // First check for the executable in current directory
        const executablePath = path.join(dirPath, executableName);
        if (fs.existsSync(executablePath)) {
            if (platform !== 'win32') {
                fs.chmodSync(executablePath, '755');
            }
            return executablePath;
        }

        // Then search subdirectories
        for (const file of files) {
            const fullPath = path.join(dirPath, file);
            if (fs.statSync(fullPath).isDirectory()) {
                const result = await searchDirectoryRecursively(fullPath, executableName, platform, isDebug);
                if (result) {
                    return result;
                }
            }
        }
    } catch (error) {
        if (isDebug) console.log(`Error searching directory ${dirPath}: ${error}`);
    }

    return null;
}

export async function run() {
    try {
        const isDebug = tl.getVariable('System.Debug') === 'true';

        // Get inputs
        const versionSpec = tl.getInput('versionSpec', true) || 'latest';
        const checkLatest = tl.getBoolInput('checkLatest', false);
        let installDirectory = tl.getInput('installDirectory', false);

        if (isDebug) {
            console.log(`Input parameters:`);
            console.log(`  versionSpec: ${versionSpec}`);
            console.log(`  checkLatest: ${checkLatest}`);
            console.log(`  installDirectory: ${installDirectory || '(not specified)'}`);
            console.log(`Platform: ${getPlatform()}`);
            console.log(`Architecture: ${getArch()}`);
        }

        // Install SqlPackage
        let toolPath: string;

        if (installDirectory) {
            // Use custom installation directory
            if (!path.isAbsolute(installDirectory)) {
                installDirectory = path.resolve(installDirectory);
            }

            // Check if SqlPackage is already installed in the specified directory
            const platform = getPlatform();
            const executableName = platform === 'win32' ? 'sqlpackage.exe' : 'sqlpackage';
            const existingExecutable = path.join(installDirectory, executableName);

            if (fs.existsSync(existingExecutable)) {
                toolPath = installDirectory;
                console.log(`SqlPackage found in custom directory: ${installDirectory}`);
            } else {
                // Download and extract to custom directory
                toolPath = await acquireSqlPackage(versionSpec, checkLatest);
                // Copy to custom directory if different
                if (toolPath !== installDirectory) {
                    if (!fs.existsSync(installDirectory)) {
                        fs.mkdirSync(installDirectory, { recursive: true });
                    }
                    if (isDebug) console.log(`Copying files from ${toolPath} to ${installDirectory}`);
                    // Copy all files from toolPath to installDirectory
                    const files = fs.readdirSync(toolPath);
                    for (const file of files) {
                        const srcPath = path.join(toolPath, file);
                        const destPath = path.join(installDirectory, file);
                        fs.copyFileSync(srcPath, destPath);

                        // Make executable on Unix systems
                        if (getPlatform() !== 'win32' && file === 'sqlpackage') {
                            fs.chmodSync(destPath, '755');
                        }
                    }
                    toolPath = installDirectory;
                }
            }
        } else {
            // Use tools cache
            toolPath = await acquireSqlPackage(versionSpec, checkLatest);
        }

        // Add to PATH
        if (isDebug) console.log(`Adding ${toolPath} to PATH`);
        tr.prependPath(toolPath);

        // Set output variables
        tl.setVariable('SqlPackageRoot', toolPath);

        console.log(`SqlPackage is ready at: ${toolPath}`);
        tl.setResult(tl.TaskResult.Succeeded, 'SqlPackage Tool Installer completed successfully');

    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`Error: ${errorMessage}`);
        tl.setResult(tl.TaskResult.Failed, errorMessage);
    }
}

// Only run if not in test mode
if (process.env.NODE_ENV !== 'test') {
    run();
}