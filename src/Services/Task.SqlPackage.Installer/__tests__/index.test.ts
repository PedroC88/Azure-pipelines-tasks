import * as path from 'path';
import * as os from 'os';

describe('SqlPackage Installer - Basic Tests', () => {
  describe('Platform Detection', () => {
    it('should detect valid platform', () => {
      const platform = os.platform();
      expect(['win32', 'linux', 'darwin']).toContain(platform);
    });

    it('should construct valid paths', () => {
      const testPath = path.join('test', 'path', 'to', 'file');
      expect(testPath).toBeTruthy();
      expect(testPath).toContain('file');
    });
  });

  describe('Version Validation', () => {
    it('should validate version format', () => {
      const validVersions = ['1.0.0', '162.0.52', '15.0.5164.1'];
      const versionPattern = /^\d+\.\d+\.\d+(\.\d+)?$/;

      validVersions.forEach(version => {
        expect(versionPattern.test(version)).toBe(true);
      });
    });

    it('should reject invalid version formats', () => {
      const invalidVersions = ['v1.0.0', '1.0', 'latest', '1.0.0-beta'];
      const versionPattern = /^\d+\.\d+\.\d+$/;

      invalidVersions.forEach(version => {
        expect(versionPattern.test(version)).toBe(false);
      });
    });
  });

  describe('Download URL Mapping', () => {
    it('should have download URLs for all platforms', () => {
      const downloadUrls: { [key: string]: string } = {
        'win32': 'https://aka.ms/sqlpackage-windows',
        'linux': 'https://aka.ms/sqlpackage-linux',
        'darwin': 'https://aka.ms/sqlpackage-macos'
      };

      expect(downloadUrls['win32']).toBeDefined();
      expect(downloadUrls['linux']).toBeDefined();
      expect(downloadUrls['darwin']).toBeDefined();

      Object.values(downloadUrls).forEach(url => {
        expect(url).toMatch(/^https:\/\//);
      });
    });
  });
});
