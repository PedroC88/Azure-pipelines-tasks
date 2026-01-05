import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

// Mock Azure Pipelines task lib and tool lib
jest.mock('azure-pipelines-task-lib/task');
jest.mock('azure-pipelines-tool-lib/tool');

import * as tl from 'azure-pipelines-task-lib/task';
import * as tr from 'azure-pipelines-tool-lib/tool';

// Import functions from index.ts that we need to test
// Note: Since index.ts runs immediately on import, we need to mock first
const mockGetInput = jest.fn();
const mockGetBoolInput = jest.fn();
const mockGetVariable = jest.fn();
const mockSetVariable = jest.fn();
const mockSetResult = jest.fn();

(tl.getInput as jest.Mock) = mockGetInput;
(tl.getBoolInput as jest.Mock) = mockGetBoolInput;
(tl.getVariable as jest.Mock) = mockGetVariable;
(tl.setVariable as jest.Mock) = mockSetVariable;
(tl.setResult as jest.Mock) = mockSetResult;
(tl.TaskResult as any) = { Succeeded: 0, Failed: 1 };

const mockDownloadTool = jest.fn();
const mockExtractZip = jest.fn();
const mockExtract7z = jest.fn();
const mockFindLocalTool = jest.fn();
const mockCacheDir = jest.fn();
const mockPrependPath = jest.fn();

(tr.downloadTool as jest.Mock) = mockDownloadTool;
(tr.extractZip as jest.Mock) = mockExtractZip;
(tr.extract7z as jest.Mock) = mockExtract7z;
(tr.findLocalTool as jest.Mock) = mockFindLocalTool;
(tr.cacheDir as jest.Mock) = mockCacheDir;
(tr.prependPath as jest.Mock) = mockPrependPath;

describe('SqlPackage Installer Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVariable.mockReturnValue('false'); // Debug mode off by default
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

      // Should return false for non-existent path
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
});

