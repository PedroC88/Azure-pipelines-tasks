# Troubleshooting

## Common Issues

### "Cannot find module 'fs.realpath'"

**Cause:** Node.js 16+ moved fs.realpath to internal modules.

**Solution:** The polyfill is automatically injected during build. If you see this error:
1. Run `npm run clean`
2. Run `npm run package`
3. Verify `fs.realpath.js` exists in SqlPackageInstaller/node_modules/

### "No versions found"

**Cause:** GitHub API failure or network issue.

**Solution:** Task automatically falls back to default versions. Check:
- Network connectivity
- GitHub API rate limits
- Enable debug mode to see detailed logs

### "SqlPackage executable not found"

**Cause:** Extraction path or file structure changed.

**Solution:**
1. Enable debug mode: `System.Debug: true`
2. Check extraction logs for actual file structure
3. Update search paths in `findSqlPackageExecutable()` if needed

### "Caching tool: SqlPackage null x64"

**Cause:** Version conversion failed or version is undefined.

**Fixed in v1.0.13+** - Now converts 4-part versions to 3-part semantic versions.

### Task shows "Node 10 handler will end-of-life"

**Fixed in v1.0.14+** - Now supports Node 10, 16, and 20 handlers.

## Debugging

### Enable Verbose Logging

**Pipeline level:**
```yaml
variables:
  System.Debug: true
```

**What you'll see:**
- GitHub API requests/responses
- Version resolution details
- File paths during extraction
- Directory listings during executable search
- Cache operations

### Check Tool Cache

**Windows:**
```powershell
$env:AGENT_TOOLSDIRECTORY
```

**Linux/macOS:**
```bash
echo $AGENT_TOOLSDIRECTORY
```

Look for `SqlPackage/{version}/x64/` directories.

### Verify Installation

After task runs:
```bash
sqlpackage /version
which sqlpackage  # Linux/macOS
where sqlpackage  # Windows
```

## Known Limitations

### Version Format
- Only supports x.y.z or x.y.z.w format
- Pre-release versions not supported
- Version ranges not supported (use exact versions)

### Platform Support
- Only x64 architecture
- ARM platforms not supported
- 32-bit agents not supported

### Download Sources
- Primary: Microsoft's SqlPackage distribution
- Requires internet connectivity on first use
- No offline installation support

## Getting Help

### Debug Checklist

1. ✓ Enable `System.Debug: true`
2. ✓ Check agent OS and architecture
3. ✓ Verify network connectivity
4. ✓ Try with `versionSpec: 'latest'`
5. ✓ Check tool cache directory exists
6. ✓ Review full task logs

### Log Analysis

**Look for these messages:**

**Success indicators:**
```
Found SqlPackage version X in cache
SqlPackage version X has been installed successfully
SqlPackage is ready at: [path]
```

**Failure indicators:**
```
Failed to get versions from GitHub releases
Unable to find SqlPackage version
SqlPackage executable not found
Failed to extract downloaded package
```

### Testing Fixes

Test locally with `run.ps1` before packaging:
```powershell
# Set test parameters
$env:INPUT_VERSIONSPEC = "latest"
$env:SYSTEM_DEBUG = "true"

# Run task
node index.js
```

## Reporting Issues

Include:
1. Task version
2. Agent OS and version
3. Full logs with `System.Debug: true`
4. Version spec used
5. Expected vs actual behavior
