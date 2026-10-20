import * as tl from 'azure-pipelines-task-lib/task';
import * as tr from 'azure-pipelines-tool-lib/tool';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

const toolName = 'SqlCmd';
const releasesUrl = 'https://api.github.com/repos/microsoft/go-sqlcmd/releases?per_page=100';

interface ReleaseAsset {
    name: string;
    browser_download_url: string;
}

interface SqlCmdRelease {
    tag_name: string;
    prerelease: boolean;
    assets: ReleaseAsset[];
}

function getPlatform(): string {
    return os.platform();
}

function getArch(): string {
    return os.arch();
}

function getExecutableName(platform: string): string {
    if (platform === 'win32') {
        return 'sqlcmd.exe';
    }
    if (platform === 'linux') {
        return 'sqlcmd';
    }
    throw new Error(`Unsupported platform: ${platform}. SqlCmdInstaller supports Windows and Linux.`);
}

function getAssetName(platform: string, arch: string): string {
    const assetPlatform = platform === 'win32' ? 'windows' : platform;
    const assetArch = arch === 'x64' ? 'amd64' : arch;
    if ((platform !== 'win32' && platform !== 'linux') || !['amd64', 'arm64'].includes(assetArch)) {
        throw new Error(`Unsupported platform or architecture: ${platform} ${arch}. SqlCmdInstaller supports Windows and Linux x64/arm64.`);
    }
    return `sqlcmd-${assetPlatform}-${assetArch}.${platform === 'win32' ? 'zip' : 'tar.bz2'}`;
}

function isVersionSpecMatch(version: string, versionSpec: string): boolean {
    const versionParts = version.split('.');
    const specParts = versionSpec.split('.');
    return specParts.every((part, index) => versionParts[index] === part);
}

async function getAvailableReleases(): Promise<SqlCmdRelease[]> {
    const releaseFile = await tr.downloadTool(releasesUrl);
    const content = fs.readFileSync(releaseFile, 'utf8');
    const releases: SqlCmdRelease[] = JSON.parse(content);
    return releases.filter(release => !release.prerelease);
}

function findAsset(releases: SqlCmdRelease[], versionSpec: string, platform: string, arch: string): {
    version: string;
    asset: ReleaseAsset;
} | undefined {
    const assetName = getAssetName(platform, arch);
    for (const release of releases) {
        const version = release.tag_name.replace(/^v/, '');
        if (versionSpec !== 'latest' && !isVersionSpecMatch(version, versionSpec)) {
            continue;
        }
        const asset = release.assets.find(candidate => candidate.name === assetName);
        if (asset) {
            return { version, asset };
        }
    }
    return undefined;
}

function findExecutable(rootPath: string, executableName: string): string | undefined {
    const executablePath = path.join(rootPath, executableName);
    if (fs.existsSync(executablePath)) {
        return executablePath;
    }

    for (const entry of fs.readdirSync(rootPath)) {
        const entryPath = path.join(rootPath, entry);
        if (fs.statSync(entryPath).isDirectory()) {
            const found = findExecutable(entryPath, executableName);
            if (found) {
                return found;
            }
        }
    }
    return undefined;
}

async function acquireSqlCmd(versionSpec: string, checkLatest: boolean): Promise<string> {
    const platform = getPlatform();
    const arch = getArch();
    const executableName = getExecutableName(platform);

    if (!checkLatest && /^\d+(?:\.\d+)*$/.test(versionSpec)) {
        const cachedPath = tr.findLocalTool(toolName, versionSpec, arch);
        if (cachedPath) {
            console.log(`SqlCmd version ${versionSpec} is already cached at: ${cachedPath}`);
            return cachedPath;
        }
    }

    const releases = await getAvailableReleases();
    const match = findAsset(releases, versionSpec, platform, arch);
    if (!match) {
        throw new Error(`No SqlCmd release matching '${versionSpec}' was found for ${platform} ${arch}.`);
    }

    const cachedPath = tr.findLocalTool(toolName, match.version, arch);
    if (cachedPath) {
        console.log(`SqlCmd version ${match.version} is already cached at: ${cachedPath}`);
        return cachedPath;
    }

    console.log(`Downloading SqlCmd version ${match.version} from ${match.asset.browser_download_url}`);
    const downloadPath = await tr.downloadTool(match.asset.browser_download_url);
    const extractedPath = platform === 'win32'
        ? await tr.extractZip(downloadPath)
        : await tr.extractTar(downloadPath);
    const executablePath = findExecutable(extractedPath, executableName);
    if (!executablePath) {
        throw new Error(`SqlCmd executable '${executableName}' was not found in the downloaded release.`);
    }

    if (platform !== 'win32') {
        fs.chmodSync(executablePath, 0o755);
    }

    const toolPath = await tr.cacheDir(path.dirname(executablePath), toolName, match.version, arch);
    console.log(`SqlCmd version ${match.version} has been cached at: ${toolPath}`);
    return toolPath;
}

export async function run(): Promise<void> {
    try {
        const versionSpec = tl.getInput('versionSpec', true) || 'latest';
        const checkLatest = tl.getBoolInput('checkLatest', false);
        let installDirectory = tl.getInput('installDirectory', false);
        const platform = getPlatform();
        const executableName = getExecutableName(platform);

        let toolPath: string;
        if (installDirectory) {
            if (!path.isAbsolute(installDirectory)) {
                installDirectory = path.resolve(installDirectory);
            }

            const executablePath = path.join(installDirectory, executableName);
            if (fs.existsSync(executablePath)) {
                toolPath = installDirectory;
                console.log(`SqlCmd found in custom directory: ${installDirectory}`);
            } else {
                const cachedPath = await acquireSqlCmd(versionSpec, checkLatest);
                if (!fs.existsSync(installDirectory)) {
                    fs.mkdirSync(installDirectory, { recursive: true });
                }
                const cachedExecutable = path.join(cachedPath, executableName);
                fs.copyFileSync(cachedExecutable, executablePath);
                if (platform !== 'win32') {
                    fs.chmodSync(executablePath, 0o755);
                }
                toolPath = installDirectory;
            }
        } else {
            toolPath = await acquireSqlCmd(versionSpec, checkLatest);
        }

        tr.prependPath(toolPath);
        tl.setVariable('SqlCmdRoot', toolPath);
        console.log(`SqlCmd is ready at: ${toolPath}`);
        tl.setResult(tl.TaskResult.Succeeded, 'SqlCmd Tool Installer completed successfully');
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`Error: ${errorMessage}`);
        tl.setResult(tl.TaskResult.Failed, errorMessage);
    }
}

if (process.env.NODE_ENV !== 'test') {
    run();
}
