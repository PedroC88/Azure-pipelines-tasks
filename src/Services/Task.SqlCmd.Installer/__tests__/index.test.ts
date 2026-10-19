process.env.NODE_ENV = 'test';

jest.mock('azure-pipelines-task-lib/task');
jest.mock('azure-pipelines-tool-lib/tool', () => ({
  downloadTool: jest.fn(),
  extractTar: jest.fn(),
  extractZip: jest.fn(),
  findLocalTool: jest.fn(),
  cacheDir: jest.fn(),
  prependPath: jest.fn(),
}));
jest.mock('fs');
jest.mock('os', () => ({
  ...jest.requireActual('os'),
  arch: jest.fn(),
  platform: jest.fn(),
}));

import * as os from 'os';
import * as fs from 'fs';
import * as tl from 'azure-pipelines-task-lib/task';

const { run } = require('../index');
const tr = require('azure-pipelines-tool-lib/tool');

describe('SqlCmd Installer', () => {
  const releases = [{
    tag_name: 'v1.10.0',
    prerelease: false,
    assets: [
      { name: 'sqlcmd-linux-amd64.tar.bz2', browser_download_url: 'https://example.com/sqlcmd-linux.tar.bz2' },
      { name: 'sqlcmd-windows-amd64.zip', browser_download_url: 'https://example.com/sqlcmd-windows.zip' },
    ],
  }];
  const platformCases: Array<['linux' | 'win32', string, string]> = [
    ['linux', 'https://example.com/sqlcmd-linux.tar.bz2', 'extractTar'],
    ['win32', 'https://example.com/sqlcmd-windows.zip', 'extractZip'],
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (os.arch as jest.Mock).mockReturnValue('x64');
    (os.platform as jest.Mock).mockReturnValue('linux');
    (tl.getInput as jest.Mock).mockImplementation((name: string) =>
      name === 'versionSpec' ? 'latest' : '');
    (tl.getBoolInput as jest.Mock).mockReturnValue(false);
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(releases));
    (fs.existsSync as jest.Mock).mockImplementation((filePath: string) =>
      filePath.endsWith('/sqlcmd') || filePath.endsWith('sqlcmd.exe'));
    (fs.readdirSync as jest.Mock).mockReturnValue([]);
    (tr.findLocalTool as jest.Mock).mockReturnValue('');
    (tr.cacheDir as jest.Mock).mockResolvedValue('/agent/_work/_tool/SqlCmd/1.10.0/x64');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each(platformCases)('installs the latest release on %s', async (platform, assetUrl, extractMethod) => {
    (os.platform as jest.Mock).mockReturnValue(platform);
    (tr.downloadTool as jest.Mock)
      .mockResolvedValueOnce('/tmp/releases.json')
      .mockResolvedValueOnce('/tmp/sqlcmd-package');
    (tr[extractMethod] as jest.Mock).mockResolvedValue('/tmp/sqlcmd-unpacked');

    await run();

    expect(tr.downloadTool).toHaveBeenNthCalledWith(1,
      'https://api.github.com/repos/microsoft/go-sqlcmd/releases?per_page=100');
    expect(tr.downloadTool).toHaveBeenNthCalledWith(2, assetUrl);
    expect(tr[extractMethod]).toHaveBeenCalledWith('/tmp/sqlcmd-package');
    expect(tr.cacheDir).toHaveBeenCalledWith(
      '/tmp/sqlcmd-unpacked',
      'SqlCmd',
      '1.10.0',
      'x64',
    );
    expect(tr.prependPath).toHaveBeenCalledWith('/agent/_work/_tool/SqlCmd/1.10.0/x64');
    expect(tl.setVariable).toHaveBeenCalledWith('SqlCmdRoot', '/agent/_work/_tool/SqlCmd/1.10.0/x64');
    expect(tl.setResult).toHaveBeenCalledWith(tl.TaskResult.Succeeded, expect.any(String));
  });

  it('uses an exact version already in the tool cache without downloading', async () => {
    (tl.getInput as jest.Mock).mockImplementation((name: string) =>
      name === 'versionSpec' ? '1.10.0' : '');
    (tr.findLocalTool as jest.Mock).mockReturnValue('/agent/_work/_tool/SqlCmd/1.10.0/x64');

    await run();

    expect(tr.downloadTool).not.toHaveBeenCalled();
    expect(tr.prependPath).toHaveBeenCalledWith('/agent/_work/_tool/SqlCmd/1.10.0/x64');
    expect(tl.setResult).toHaveBeenCalledWith(tl.TaskResult.Succeeded, expect.any(String));
  });

  it('copies sqlcmd to a custom installation directory', async () => {
    (tl.getInput as jest.Mock).mockImplementation((name: string) => {
      if (name === 'versionSpec') return 'latest';
      if (name === 'installDirectory') return '/custom/sqlcmd';
      return '';
    });
    (tr.downloadTool as jest.Mock)
      .mockResolvedValueOnce('/tmp/releases.json')
      .mockResolvedValueOnce('/tmp/sqlcmd-package');
    (tr.extractTar as jest.Mock).mockResolvedValue('/tmp/sqlcmd-unpacked');
    (fs.existsSync as jest.Mock).mockImplementation((filePath: string) =>
      !filePath.startsWith('/custom/sqlcmd/') && filePath.endsWith('/sqlcmd'));

    await run();

    expect(fs.copyFileSync).toHaveBeenCalledWith(
      '/agent/_work/_tool/SqlCmd/1.10.0/x64/sqlcmd',
      '/custom/sqlcmd/sqlcmd',
    );
    expect(tr.prependPath).toHaveBeenCalledWith('/custom/sqlcmd');
    expect(tl.setVariable).toHaveBeenCalledWith('SqlCmdRoot', '/custom/sqlcmd');
  });

  it('fails clearly when the release is unavailable', async () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    (tr.downloadTool as jest.Mock).mockResolvedValue('/tmp/releases.json');
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify([]));

    await run();

    expect(tl.setResult).toHaveBeenCalledWith(
      tl.TaskResult.Failed,
      expect.stringContaining("No SqlCmd release matching 'latest'"),
    );
  });
});
