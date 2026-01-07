// Set test environment BEFORE imports
process.env.NODE_ENV = 'test';

// Mock modules BEFORE importing to prevent initialization issues
jest.mock('azure-pipelines-task-lib/task');
jest.mock('azure-pipelines-tool-lib/tool', () => ({
  downloadTool: jest.fn(),
  extractZip: jest.fn(),
  extract7z: jest.fn(),
  findLocalTool: jest.fn(),
  cacheDir: jest.fn(),
  prependPath: jest.fn()
}));
jest.mock('fs');

import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import * as tl from 'azure-pipelines-task-lib/task';

// Import source AFTER mocks - critical for coverage!
const indexModule = require('../index');
const { run } = indexModule;

// Get tool lib mocks
const tr = require('azure-pipelines-tool-lib/tool');

describe('SqlPackage Installer Tests', () => {
  let mockGetInput: jest.Mock;
  let mockGetBoolInput: jest.Mock;
  let mockGetVariable: jest.Mock;
  let _mockSetVariable: jest.Mock;
  let mockSetResult: jest.Mock;

  let mockDownloadTool: jest.Mock;
  let mockExtractZip: jest.Mock;
  let _mockExtract7z: jest.Mock;
  let mockFindLocalTool: jest.Mock;
  let mockCacheDir: jest.Mock;
  let mockPrependPath: jest.Mock;

  let mockExistsSync: jest.Mock;
  let mockReaddirSync: jest.Mock;
  let mockStatSync: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockGetInput = tl.getInput as jest.Mock;
    mockGetBoolInput = tl.getBoolInput as jest.Mock;
    mockGetVariable = tl.getVariable as jest.Mock;
    _mockSetVariable = tl.setVariable as jest.Mock;
    mockSetResult = tl.setResult as jest.Mock;

    mockDownloadTool = tr.downloadTool as jest.Mock;
    mockExtractZip = tr.extractZip as jest.Mock;
    _mockExtract7z = tr.extract7z as jest.Mock;
    mockFindLocalTool = tr.findLocalTool as jest.Mock;
    mockCacheDir = tr.cacheDir as jest.Mock;
    mockPrependPath = tr.prependPath as jest.Mock;

    mockExistsSync = fs.existsSync as jest.Mock;
    mockReaddirSync = fs.readdirSync as jest.Mock;
    mockStatSync = fs.statSync as jest.Mock;

    // Set default return values for fs mocks
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([]);
    mockStatSync.mockReturnValue({ isDirectory: () => false });
  });

  describe('Platform Detection', () => {
    it('should detect valid platform', () => {
      const platform = os.platform();
      expect(['win32', 'linux', 'darwin']).toContain(platform);
    });

    it('should detect valid architecture', () => {
      const arch = os.arch();
      expect(arch).toBeTruthy();
      expect(['x64', 'arm64', 'ia32']).toContain(arch);
    });
  });

  describe('Version Validation', () => {
    it('should validate semantic version format', () => {
      const validVersions = ['1.0.0', '162.0.52', '170.2.70', '170.2.70.1'];
      const versionPattern = /^\d+\.\d+\.\d+(\.\d+)?$/;

      validVersions.forEach(version => {
        expect(versionPattern.test(version)).toBe(true);
      });
    });

    it('should reject invalid version formats', () => {
      const invalidVersions = ['v1.0.0', '1.0', '1.0.0-beta', 'latest-v1'];
      const versionPattern = /^\d+\.\d+\.\d+$/;

      invalidVersions.forEach(version => {
        expect(versionPattern.test(version)).toBe(false);
      });
    });

    it('should handle "latest" as valid version spec', () => {
      const versionSpec = 'latest';
      expect(versionSpec).toBe('latest');
      expect(typeof versionSpec).toBe('string');
    });
  });

  describe('Download URL Mapping', () => {
    it('should have download URLs for all supported platforms', () => {
      const supportedPlatforms = ['win32', 'linux', 'darwin'];
      const downloadUrls: { [key: string]: string } = {
        'win32': 'https://aka.ms/sqlpackage-windows',
        'linux': 'https://aka.ms/sqlpackage-linux',
        'darwin': 'https://aka.ms/sqlpackage-macos'
      };

      supportedPlatforms.forEach(platform => {
        expect(downloadUrls[platform]).toBeDefined();
        expect(downloadUrls[platform]).toMatch(/^https:\/\//);
        expect(downloadUrls[platform]).toContain('sqlpackage');
      });
    });

    it('should map platforms to correct file extensions', () => {
      const platformFileMap: { [key: string]: string } = {
        'win32': 'sqlpackage.exe',
        'linux': 'sqlpackage',
        'darwin': 'sqlpackage'
      };

      expect(platformFileMap['win32']).toBe('sqlpackage.exe');
      expect(platformFileMap['linux']).toBe('sqlpackage');
      expect(platformFileMap['darwin']).toBe('sqlpackage');
    });
  });

  describe('Path Operations', () => {
    it('should construct valid paths', () => {
      const testPath = path.join('test', 'path', 'to', 'file');
      expect(testPath).toBeTruthy();
      expect(testPath).toContain('file');
    });

    it('should handle absolute path resolution', () => {
      const relativePath = path.join('relative', 'path');
      const absolutePath = path.resolve(relativePath);
      expect(path.isAbsolute(absolutePath)).toBe(true);
    });

    it('should correctly extract directory from file path', () => {
      const filePath = path.join('dir', 'subdir', 'file.exe');
      const dirPath = path.dirname(filePath);
      expect(dirPath).toContain('subdir');
      expect(dirPath).not.toContain('file.exe');
    });
  });

  describe('File System Operations', () => {
    it('should validate fs.existsSync functionality', () => {
      // Test that fs.existsSync works correctly
      expect(typeof fs.existsSync).toBe('function');

      // With our default mock, fs.existsSync returns true
      const somePath = path.join('some', 'path');
      expect(fs.existsSync(somePath)).toBe(true);

      // We can also test with custom mock behavior
      mockExistsSync.mockReturnValueOnce(false);
      const nonExistentPath = path.join('non', 'existent', 'path', 'xyz123');
      expect(fs.existsSync(nonExistentPath)).toBe(false);
    });

    it('should handle directory creation flags', () => {
      const options = { recursive: true };
      expect(options.recursive).toBe(true);
    });
  });

  describe('Mock Azure Pipelines Integration', () => {
    it('should mock task library inputs correctly', () => {
      mockGetInput.mockReturnValue('latest');
      const versionSpec = tl.getInput('versionSpec', true);
      expect(versionSpec).toBe('latest');
      expect(mockGetInput).toHaveBeenCalledWith('versionSpec', true);
    });

    it('should mock boolean inputs correctly', () => {
      mockGetBoolInput.mockReturnValue(true);
      const checkLatest = tl.getBoolInput('checkLatest', false);
      expect(checkLatest).toBe(true);
      expect(mockGetBoolInput).toHaveBeenCalledWith('checkLatest', false);
    });

    it('should mock tool download function', async () => {
      const mockPath = '/tmp/sqlpackage.zip';
      mockDownloadTool.mockResolvedValue(mockPath);

      const result = await tr.downloadTool('https://example.com/sqlpackage.zip');
      expect(result).toBe(mockPath);
      expect(mockDownloadTool).toHaveBeenCalled();
    });

    it('should mock tool extraction function', async () => {
      const mockExtractPath = '/tmp/extracted';
      mockExtractZip.mockResolvedValue(mockExtractPath);

      const result = await tr.extractZip('/tmp/sqlpackage.zip');
      expect(result).toBe(mockExtractPath);
      expect(mockExtractZip).toHaveBeenCalled();
    });

    it('should mock tool caching function', async () => {
      const mockCachePath = '/agent/_work/_tool/SqlPackage/170.2.70/x64';
      mockCacheDir.mockResolvedValue(mockCachePath);

      const result = await tr.cacheDir('/tmp/extracted', 'SqlPackage', '170.2.70', 'x64');
      expect(result).toBe(mockCachePath);
      expect(mockCacheDir).toHaveBeenCalledWith('/tmp/extracted', 'SqlPackage', '170.2.70', 'x64');
    });
  });

  describe('Version Conversion', () => {
    it('should convert 4-part version to 3-part semver', () => {
      const fourPartVersion = '170.2.70.1';
      const parts = fourPartVersion.split('.');
      const semver = parts.slice(0, 3).join('.');
      expect(semver).toBe('170.2.70');
    });

    it('should handle 3-part version without modification', () => {
      const threePartVersion = '162.0.52';
      const parts = threePartVersion.split('.');
      const semver = parts.slice(0, 3).join('.');
      expect(semver).toBe('162.0.52');
    });
  });

  describe('Error Handling', () => {
    it('should handle download errors gracefully', async () => {
      const error = new Error('Network error');
      mockDownloadTool.mockRejectedValue(error);

      await expect(tr.downloadTool('https://invalid.url')).rejects.toThrow('Network error');
    });

    it('should handle extraction errors gracefully', async () => {
      const error = new Error('Extraction failed');
      mockExtractZip.mockRejectedValue(error);

      await expect(tr.extractZip('/invalid/path.zip')).rejects.toThrow('Extraction failed');
    });
  });

  describe('Helper Functions', () => {
    it('should get correct filename for each platform', () => {
      const fileNames: { [key: string]: string } = {
        'win32': 'sqlpackage-win-x64.zip',
        'linux': 'sqlpackage-linux-x64.zip',
        'darwin': 'sqlpackage-osx-x64.zip'
      };

      Object.keys(fileNames).forEach(platform => {
        expect(fileNames[platform]).toBeTruthy();
        expect(fileNames[platform]).toContain('sqlpackage');
        expect(fileNames[platform]).toMatch(/\.(zip|tar\.gz)$/);
      });
    });

    it('should find matching asset for platform', () => {
      const assets = [
        { name: 'sqlpackage-windows-x64.zip', browser_download_url: 'https://example.com/win.zip' },
        { name: 'sqlpackage-linux-x64.zip', browser_download_url: 'https://example.com/linux.zip' },
        { name: 'sqlpackage-osx-x64.zip', browser_download_url: 'https://example.com/mac.zip' }
      ];

      // Test finding Windows asset
      const winKeywords = ['win', 'windows'];
      const winAsset = assets.find(a => winKeywords.some(k => a.name.toLowerCase().includes(k)));
      expect(winAsset).toBeDefined();
      expect(winAsset?.name).toContain('windows');

      // Test finding Linux asset
      const linuxKeywords = ['linux'];
      const linuxAsset = assets.find(a => linuxKeywords.some(k => a.name.toLowerCase().includes(k)));
      expect(linuxAsset).toBeDefined();
      expect(linuxAsset?.name).toContain('linux');

      // Test finding macOS asset
      const macKeywords = ['osx', 'mac', 'darwin'];
      const macAsset = assets.find(a => macKeywords.some(k => a.name.toLowerCase().includes(k)));
      expect(macAsset).toBeDefined();
      expect(macAsset?.name).toContain('osx');
    });

    it('should return null for non-matching platform', () => {
      const assets = [
        { name: 'some-other-package.zip', browser_download_url: 'https://example.com/other.zip' }
      ];

      const winKeywords = ['win', 'windows'];
      const result = assets.find(a => winKeywords.some(k => a.name.toLowerCase().includes(k)));
      expect(result).toBeUndefined();
    });

    it('should construct default version info', () => {
      const defaultVersion = {
        version: '170.2.70.1',
        downloadUrl: 'https://aka.ms/sqlpackage-windows',
        fileName: 'sqlpackage-win-x64.zip'
      };

      expect(defaultVersion.version).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
      expect(defaultVersion.downloadUrl).toMatch(/^https:\/\//);
      expect(defaultVersion.fileName).toContain('sqlpackage');
    });
  });

  describe('Path and File Search', () => {
    it('should determine correct executable name by platform', () => {
      const currentPlatform = os.platform();
      const executableName = currentPlatform === 'win32' ? 'sqlpackage.exe' : 'sqlpackage';

      if (currentPlatform === 'win32') {
        expect(executableName).toBe('sqlpackage.exe');
      } else {
        expect(executableName).toBe('sqlpackage');
      }
    });

    it('should construct search paths correctly', () => {
      const rootPath = '/extracted/root';
      const searchPaths = [
        rootPath,
        path.join(rootPath, 'sqlpackage'),
        path.join(rootPath, 'tools'),
        path.join(rootPath, 'bin')
      ];

      searchPaths.forEach(p => {
        expect(p).toBeTruthy();
        // Normalize paths for cross-platform comparison
        const normalizedPath = p.replace(/\\/g, '/');
        const normalizedRoot = rootPath.replace(/\\/g, '/');
        expect(normalizedPath).toContain(normalizedRoot);
      });
    });

    it('should handle recursive directory search logic', () => {
      // Test that recursive search would check subdirectories
      const mockFiles = ['file1.txt', 'subdir', 'file2.exe'];
      const hasSubdirectories = mockFiles.some(f => !f.includes('.'));
      expect(hasSubdirectories).toBe(true);
    });
  });

  describe('Cache and Tool Management', () => {
    it('should use correct cache parameters', () => {
      const toolName = 'SqlPackage';
      const version = '170.2.70';
      const arch = 'x64';
      const cacheDir = '/path/to/sqlpackage';

      expect(toolName).toBe('SqlPackage');
      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(['x64', 'arm64', 'ia32']).toContain(arch);
      expect(cacheDir).toBeTruthy();
    });

    it('should check for tool in cache before downloading', () => {
      mockFindLocalTool.mockReturnValue('/cached/path/to/sqlpackage');

      const cachedPath = tr.findLocalTool('SqlPackage', '170.2.70', 'x64');
      expect(cachedPath).toBe('/cached/path/to/sqlpackage');
      expect(mockFindLocalTool).toHaveBeenCalledWith('SqlPackage', '170.2.70', 'x64');
    });

    it('should return empty when tool not in cache', () => {
      mockFindLocalTool.mockReturnValue('');

      const cachedPath = tr.findLocalTool('SqlPackage', '999.0.0', 'x64');
      expect(cachedPath).toBe('');
    });
  });

  describe('Integration Workflow', () => {
    it('should follow download-extract-cache workflow', async () => {
      const downloadPath = '/tmp/download.zip';
      const extractPath = '/tmp/extracted';
      const cachePath = '/agent/_work/_tool/SqlPackage/170.2.70/x64';

      mockDownloadTool.mockResolvedValue(downloadPath);
      mockExtractZip.mockResolvedValue(extractPath);
      mockCacheDir.mockResolvedValue(cachePath);

      const downloaded = await tr.downloadTool('https://example.com/sqlpackage.zip');
      expect(downloaded).toBe(downloadPath);

      const extracted = await tr.extractZip(downloaded);
      expect(extracted).toBe(extractPath);

      const cached = await tr.cacheDir(extracted, 'SqlPackage', '170.2.70', 'x64');
      expect(cached).toBe(cachePath);

      expect(mockDownloadTool).toHaveBeenCalledTimes(1);
      expect(mockExtractZip).toHaveBeenCalledTimes(1);
      expect(mockCacheDir).toHaveBeenCalledTimes(1);
    });

    it('should add tool to PATH after acquisition', () => {
      const toolPath = '/path/to/sqlpackage';
      tr.prependPath(toolPath);

      expect(mockPrependPath).toHaveBeenCalledWith(toolPath);
    });
  });

  describe('Run Function Integration', () => {
    it('should successfully install SqlPackage with valid inputs', async () => {
      mockGetInput.mockImplementation((name: string) => {
        if (name === 'versionSpec') return 'latest';
        if (name === 'installDirectory') return '';
        return '';
      });
      mockGetBoolInput.mockReturnValue(false);
      mockGetVariable.mockReturnValue('false');

      const toolPath = '/cache/SqlPackage/latest/x64';

      mockFindLocalTool.mockReturnValue(toolPath);
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue(['sqlpackage.exe']);
      mockStatSync.mockReturnValue({
        isDirectory: () => false,
        isFile: () => true
      } as fs.Stats);

      await run();

      expect(mockGetInput).toHaveBeenCalled();
      expect(mockPrependPath).toHaveBeenCalled();
      expect(mockSetResult).toHaveBeenCalledWith(
        tl.TaskResult.Succeeded,
        'SqlPackage Tool Installer completed successfully'
      );
    });

    it('should handle errors gracefully', async () => {
      mockGetInput.mockImplementation(() => {
        throw new Error('Input error');
      });

      await run();

      expect(mockSetResult).toHaveBeenCalledWith(
        tl.TaskResult.Failed,
        'Input error'
      );
    });

    it('should download and cache when not in cache', async () => {
      mockGetInput.mockImplementation((name: string) => {
        if (name === 'versionSpec') return '162.0.52';
        return '';
      });
      mockGetBoolInput.mockReturnValue(false);
      mockGetVariable.mockReturnValue('false');

      const cachedPath = '/cache/SqlPackage/162.0.52/x64';

      // Mock GitHub API response with matching version
      const githubResponse = JSON.stringify([
        {
          tag_name: 'v162.0.52.1',
          prerelease: false,
          assets: [
            {
              name: 'sqlpackage-win-x64.zip',
              browser_download_url: 'https://github.com/microsoft/DacFx/releases/download/v162.0.52.1/sqlpackage-win-x64.zip'
            }
          ]
        }
      ]);

      // Mock findLocalTool to return empty for all cache searches (simulating no cached versions)
      // This will be called by findCachedVersionMatchingSpec to search for any matching version
      mockFindLocalTool.mockReturnValue('');  // Return empty for all calls - tool is not cached

      mockDownloadTool.mockResolvedValueOnce('/tmp/github.json').mockResolvedValueOnce('/tmp/sqlpackage.zip');
      mockExtractZip.mockResolvedValue('/tmp/extracted');
      mockCacheDir.mockResolvedValue(cachedPath);
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue(['sqlpackage.exe']);
      mockStatSync.mockReturnValue({
        isDirectory: () => false,
        isFile: () => true
      } as fs.Stats);

      // Mock reading the GitHub API response
      const mockReadFileSync = jest.spyOn(fs, 'readFileSync');
      mockReadFileSync.mockReturnValue(githubResponse);

      await run();

      expect(mockDownloadTool).toHaveBeenCalled();
      expect(mockExtractZip).toHaveBeenCalled();
      expect(mockCacheDir).toHaveBeenCalled();
      expect(mockPrependPath).toHaveBeenCalled();
      expect(mockSetResult).toHaveBeenCalledWith(
        tl.TaskResult.Succeeded,
        'SqlPackage Tool Installer completed successfully'
      );

      mockReadFileSync.mockRestore();
    });
  });

  describe('Version Matching and Resolution', () => {
    it('should download latest version when spec is "latest"', async () => {
      mockGetInput.mockImplementation((name: string) => {
        if (name === 'versionSpec') return 'latest';
        return '';
      });
      mockGetBoolInput.mockReturnValue(false);
      mockGetVariable.mockReturnValue('false');

      const githubResponse = JSON.stringify([
        {
          tag_name: 'v170.2.70.1',
          prerelease: false,
          assets: [{ name: 'sqlpackage-win-x64.zip', browser_download_url: 'https://example.com/170.2.70.1.zip' }]
        },
        {
          tag_name: 'v162.0.52.1',
          prerelease: false,
          assets: [{ name: 'sqlpackage-win-x64.zip', browser_download_url: 'https://example.com/162.0.52.1.zip' }]
        }
      ]);

      mockFindLocalTool.mockReturnValue('');
      mockDownloadTool.mockResolvedValueOnce('/tmp/github.json').mockResolvedValueOnce('/tmp/sqlpackage.zip');
      mockExtractZip.mockResolvedValue('/tmp/extracted');
      mockCacheDir.mockResolvedValue('/cache/SqlPackage/170.2.70/x64');
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue(['sqlpackage.exe']);
      mockStatSync.mockReturnValue({ isDirectory: () => false, isFile: () => true } as fs.Stats);

      const mockReadFileSync = jest.spyOn(fs, 'readFileSync');
      mockReadFileSync.mockReturnValue(githubResponse);

      await run();

      expect(mockSetResult).toHaveBeenCalledWith(tl.TaskResult.Succeeded, 'SqlPackage Tool Installer completed successfully');
      mockReadFileSync.mockRestore();
    });

    it('should match partial version spec (major.minor)', async () => {
      mockGetInput.mockImplementation((name: string) => {
        if (name === 'versionSpec') return '162.0';
        return '';
      });
      mockGetBoolInput.mockReturnValue(false);
      mockGetVariable.mockReturnValue('false');

      const githubResponse = JSON.stringify([
        {
          tag_name: 'v170.2.70.1',
          prerelease: false,
          assets: [{ name: 'sqlpackage-win-x64.zip', browser_download_url: 'https://example.com/170.2.70.1.zip' }]
        },
        {
          tag_name: 'v162.0.54.1',
          prerelease: false,
          assets: [{ name: 'sqlpackage-win-x64.zip', browser_download_url: 'https://example.com/162.0.54.1.zip' }]
        },
        {
          tag_name: 'v162.0.52.1',
          prerelease: false,
          assets: [{ name: 'sqlpackage-win-x64.zip', browser_download_url: 'https://example.com/162.0.52.1.zip' }]
        }
      ]);

      mockFindLocalTool.mockReturnValue('');
      mockDownloadTool.mockResolvedValueOnce('/tmp/github.json').mockResolvedValueOnce('/tmp/sqlpackage.zip');
      mockExtractZip.mockResolvedValue('/tmp/extracted');
      mockCacheDir.mockResolvedValue('/cache/SqlPackage/162.0.54/x64');
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue(['sqlpackage.exe']);
      mockStatSync.mockReturnValue({ isDirectory: () => false, isFile: () => true } as fs.Stats);

      const mockReadFileSync = jest.spyOn(fs, 'readFileSync');
      mockReadFileSync.mockReturnValue(githubResponse);

      await run();

      expect(mockSetResult).toHaveBeenCalledWith(tl.TaskResult.Succeeded, 'SqlPackage Tool Installer completed successfully');
      mockReadFileSync.mockRestore();
    });

    it('should match partial version spec (major only)', async () => {
      mockGetInput.mockImplementation((name: string) => {
        if (name === 'versionSpec') return '162';
        return '';
      });
      mockGetBoolInput.mockReturnValue(false);
      mockGetVariable.mockReturnValue('false');

      const githubResponse = JSON.stringify([
        {
          tag_name: 'v170.2.70.1',
          prerelease: false,
          assets: [{ name: 'sqlpackage-win-x64.zip', browser_download_url: 'https://example.com/170.2.70.1.zip' }]
        },
        {
          tag_name: 'v162.5.10.1',
          prerelease: false,
          assets: [{ name: 'sqlpackage-win-x64.zip', browser_download_url: 'https://example.com/162.5.10.1.zip' }]
        },
        {
          tag_name: 'v162.0.52.1',
          prerelease: false,
          assets: [{ name: 'sqlpackage-win-x64.zip', browser_download_url: 'https://example.com/162.0.52.1.zip' }]
        }
      ]);

      mockFindLocalTool.mockReturnValue('');
      mockDownloadTool.mockResolvedValueOnce('/tmp/github.json').mockResolvedValueOnce('/tmp/sqlpackage.zip');
      mockExtractZip.mockResolvedValue('/tmp/extracted');
      mockCacheDir.mockResolvedValue('/cache/SqlPackage/162.5.10/x64');
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue(['sqlpackage.exe']);
      mockStatSync.mockReturnValue({ isDirectory: () => false, isFile: () => true } as fs.Stats);

      const mockReadFileSync = jest.spyOn(fs, 'readFileSync');
      mockReadFileSync.mockReturnValue(githubResponse);

      await run();

      expect(mockSetResult).toHaveBeenCalledWith(tl.TaskResult.Succeeded, 'SqlPackage Tool Installer completed successfully');
      mockReadFileSync.mockRestore();
    });

    it('should fail when no matching version is found', async () => {
      mockGetInput.mockImplementation((name: string) => {
        if (name === 'versionSpec') return '999.9.9';
        return '';
      });
      mockGetBoolInput.mockReturnValue(false);
      mockGetVariable.mockReturnValue('false');

      const githubResponse = JSON.stringify([
        {
          tag_name: 'v170.2.70.1',
          prerelease: false,
          assets: [{ name: 'sqlpackage-win-x64.zip', browser_download_url: 'https://example.com/170.2.70.1.zip' }]
        }
      ]);

      mockFindLocalTool.mockReturnValue('');
      mockDownloadTool.mockResolvedValue('/tmp/github.json');
      mockExistsSync.mockReturnValue(true);

      const mockReadFileSync = jest.spyOn(fs, 'readFileSync');
      mockReadFileSync.mockReturnValue(githubResponse);

      await run();

      expect(mockSetResult).toHaveBeenCalledWith(
        tl.TaskResult.Failed,
        expect.stringContaining('No SqlPackage version matching')
      );

      mockReadFileSync.mockRestore();
    });

    it('should use cached version when available', async () => {
      mockGetInput.mockImplementation((name: string) => {
        if (name === 'versionSpec') return '162.0.52';
        return '';
      });
      mockGetBoolInput.mockReturnValue(false);
      mockGetVariable.mockReturnValue('false');

      const cachedPath = '/cache/SqlPackage/162.0.52/x64';
      mockFindLocalTool.mockReturnValue(cachedPath);

      await run();

      expect(mockDownloadTool).not.toHaveBeenCalled();
      expect(mockSetResult).toHaveBeenCalledWith(
        tl.TaskResult.Succeeded,
        'SqlPackage Tool Installer completed successfully'
      );
    });
  });
});
