# Version History

## v1.0.36 (Current)
**Date:** January 2026

### Features
- **Smart version resolution:** Queries GitHub releases to find versions
- **Flexible version specs:** Support for partial versions (e.g., "162", "162.0", "162.0.52")
- **Intelligent caching:** Checks cache before downloading
- **Enhanced messaging:** Clear feedback about version resolution and caching

### Changes
- Version spec now queries `https://api.github.com/repos/microsoft/DacFx/releases`
- Finds latest build matching your version specification
- Examples:
  - `versionSpec: "latest"` → Downloads most recent release
  - `versionSpec: "162.0.52"` → Downloads latest 162.0.52.x build
  - `versionSpec: "162"` → Downloads latest 162.x.x.x version

### User Impact
- Can now install specific SqlPackage versions reliably
- Better control over which version is used in pipelines
- Clearer console output showing resolved version and download URL

### Migration
- Existing pipelines continue to work without changes
- Consider using partial version specs for flexibility (e.g., "162.0" instead of "162.0.52.1")

---

## v1.0.20
**Date:** January 2026

### Changes
- Reduced verbose logging output
- Detailed logs now only show when `System.Debug=true`
- Cleaned up solution structure
- Removed development artifacts from repository
- Updated .gitignore for build artifacts

### User Impact
- Cleaner pipeline logs by default
- Same functionality, less noise
- Enable debug mode for troubleshooting

---

## v1.0.14
**Date:** January 2026

### Changes
- Added multi-Node version support (Node 10, 16, 20)
- Updated task.json execution block

### Fixes
- Eliminated "Node handler will end-of-life" warnings
- Improved compatibility across agent versions

---

## v1.0.13
**Date:** January 2026

### Changes
- Semantic versioning conversion (4-part → 3-part)
- Example: `170.2.70.1` → `170.2.70`

### Fixes
- **Critical:** Fixed "Caching tool: SqlPackage null x64" error
- Azure Pipelines Tool Library now accepts versions correctly

---

## v1.0.9 - v1.0.12
**Date:** January 2026

### Changes
- Enhanced executable search with recursive directory traversal
- Improved extraction process
- Better file format detection
- Added Docker container compatibility

### Fixes
- Fixed "SqlPackage executable not found" errors
- Improved extraction reliability
- Better handling of different package structures

---

## v1.0.6 - v1.0.8
**Date:** January 2026

### Changes
- Robust version resolution with fallback
- Default version list for offline scenarios
- Enhanced error messages

### Fixes
- Fixed "No versions found" errors
- Better GitHub API error handling
- Graceful degradation when API unavailable

---

## v1.0.4 - v1.0.5
**Date:** January 2026

### Changes
- Added fs.realpath polyfill
- Node.js 16+ compatibility

### Fixes
- Fixed "Cannot find module 'fs.realpath'" error
- prepare-minimal.ps1 now injects polyfill automatically

---

## v1.0.0 - v1.0.3
**Date:** January 2026

### Initial Release
- SqlPackage installation and caching
- Cross-platform support (Windows, Linux, macOS)
- Version selection (specific or 'latest')
- Tool cache integration
- PATH configuration

---

## Breaking Changes

None. All versions maintain backward compatibility.

## Upgrade Path

Simply update the task version in your pipeline:

```yaml
# From any version
- task: SqlPackageInstaller@1
  inputs:
    versionSpec: 'latest'
```

No pipeline changes required.

## Future Roadmap

### Planned Features
- ARM64 architecture support
- Offline installation mode
- Version range support
- Pre-release version support

### Under Consideration
- Custom download sources
- Proxy support
- Checksum verification
- Multiple version installation
