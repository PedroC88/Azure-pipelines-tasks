# Build Process

## Quick Build

```bash
npm install
npm run package
```

This produces `PedroC88.sqlpackage-installer-{version}.vsix`

## Build Steps Explained

### 1. Install Dependencies
```bash
npm install
```
Installs all dependencies including dev dependencies.

### 2. Package (Automated)
```bash
npm run package
```

**What happens:**
1. **Build** - Compiles TypeScript to JavaScript
2. **Prepare Minimal** - Creates optimized node_modules
3. **Create VSIX** - Packages extension
4. **Restore Modules** - Restores full node_modules

### Manual Steps (Optional)

**Clean:**
```bash
npm run clean
```
Removes build artifacts, node_modules_minimal, *.vsix

**Build only:**
```bash
npm run build
```
Compiles TypeScript without packaging.

## Packaging Details

### prepare-minimal.ps1

Creates a minimal node_modules for the VSIX package:

1. Installs production dependencies only
2. Injects `fs.realpath` polyfill for Node.js 16+ compatibility
3. Copies compiled files to `SqlPackageInstaller/` directory
4. Removes unnecessary files (tests, docs, examples)

### What Gets Packaged

**Included:**
- `SqlPackageInstaller/` directory with:
  - Compiled JavaScript (`index.js`)
  - Task definition (`task.json`)
  - Minimal node_modules
  - Package manifest (`package.json`)
- `vss-extension.json` manifest
- `README.md`

**Excluded (via .vsixignore):**
- TypeScript source files (`*.ts`)
- Build artifacts (`*.js.map`, `*.d.ts`)
- Development scripts (`test.ps1`, `run.ps1`)
- node_modules root directory
- temp/ and tools/ directories

## Version Management

Update version in 3 files:
1. `package.json` - `"version": "1.0.15"`
2. `task.json` - Major/Minor/Patch object
3. `vss-extension.json` - `"version": "1.0.15"`

## Testing Locally

After packaging, upload the `.vsix` file to Azure DevOps:
1. Navigate to Organization Settings
2. Extensions → Browse marketplace
3. Manage extensions → Upload extension
4. Select your `.vsix` file

## Build Scripts Reference

| Script | Purpose |
|--------|---------|
| `build` | Compile TypeScript |
| `clean` | Remove build artifacts |
| `package` | Full build + package |
| `prepare-minimal` | Create minimal dependencies |
| `restore-modules` | Restore full node_modules |

## Troubleshooting

**Build fails with TypeScript errors:**
- Check `index.ts` for syntax errors
- Ensure all imports are valid

**VSIX too large:**
- Check `.vsixignore` is excluding unnecessary files
- Verify prepare-minimal.ps1 is removing dev dependencies

**Missing dependencies at runtime:**
- Ensure production dependencies are in `package.json`
- Check prepare-minimal.ps1 includes required packages
