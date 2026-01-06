# Build Process

## Quick Build

```bash
npm install
npm run package
```

Alternatively you can use the clean-rebuild.ps1 script.

This produces `PedroC88.sqlpackage-publisher-{version}.vsix`

## Build Steps Explained

### 1. Install Dependencies
```bash
npm install
```
Installs all dependencies including dev dependencies.

### 2. Lint Code
```bash
npm run lint
```
Runs ESLint to check code quality and consistency.

### 3. Run Tests
```bash
npm test
```
Executes Jest test suite (22 comprehensive tests covering all functionality).

### 4. Package (Automated)
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

1. Creates temporary build directory
2. Installs production dependencies only (`--omit=dev`)
3. Copies compiled files to `SqlPackagePublisher/` directory
4. Removes unnecessary files (tests, docs, examples)

### What Gets Packaged

**Included:**
- `SqlPackagePublisher/` directory with:
  - Compiled JavaScript (`index.js`)
  - Task definition (`task.json`)
  - Minimal node_modules
  - Icon (`icon.png`)
- `vss-extension.json` manifest
- `overview.md` (marketplace description)

**Excluded (via .vsixignore):**
- TypeScript source files (`*.ts`)
- Test files (`__tests__/`, `*.test.ts`)
- Build artifacts (`*.js.map`, `*.d.ts`)
- Development scripts
- node_modules root directory
- temp/ and .taskkey files

## Version Management

Update version in 3 files:
1. `package.json` - `"version": "0.0.1"`
2. `task.json` - Major/Minor/Patch object
3. `vss-extension.json` - `"version": "0.0.1"`

**Version Scheme:**
- `0.x.x` - Pre-release/beta versions
- `1.0.0` - First stable release
- `1.x.x` - Minor updates and bug fixes
- `2.0.0` - Breaking changes

## Testing Locally

### Unit Tests
```bash
npm test
```

Runs 22 comprehensive tests covering:
- Input validation
- All authentication methods
- Connection string building
- Publish profile handling
- Additional arguments parsing
- Error handling

### Manual Testing

After packaging, upload the `.vsix` file to Azure DevOps:
1. Navigate to Organization Settings
2. Extensions → Browse marketplace
3. Manage extensions → Upload extension
4. Select your `.vsix` file
5. Test in a pipeline with actual database

## Build Scripts Reference

| Script | Purpose |
|--------|---------|
| `build` | Compile TypeScript |
| `clean` | Remove build artifacts |
| `lint` | Run ESLint |
| `test` | Run Jest tests |
| `package` | Full build + package |
| `prepare-minimal` | Create minimal dependencies |
| `restore-modules` | Restore full node_modules |

## CI/CD Integration

### GitHub Actions Workflow

The project includes `publish-publisher.yml` workflow that:
1. Triggers on changes to `src/Services/Task.SqlPackage.Publisher/**`
2. Runs lint, tests, and builds on every push to develop
3. Creates VSIX package
4. Publishes to Azure DevOps Marketplace (on version change)
5. Creates GitHub release

### Manual Workflow Trigger

Workflow can be triggered manually with `force_publish` option to publish even if version hasn't changed.

## Troubleshooting

**Build fails with TypeScript errors:**
- Check `index.ts` for syntax errors
- Ensure all imports are valid
- Run `npm run lint` to see detailed errors

**VSIX too large:**
- Check `.vsixignore` is excluding unnecessary files
- Verify prepare-minimal.ps1 is using `--omit=dev`
- Confirm test files are excluded

**Tests fail:**
- Ensure mocks are properly configured
- Check that `NODE_ENV=test` is set before imports
- Verify test file hasn't been modified incorrectly

**Package script fails:**
- Ensure tfx-cli is installed: `npm install -g tfx-cli`
- Check vss-extension.json for syntax errors
- Verify all required files exist (icon.png, overview.md)

**Icon missing in package:**
- Ensure icon.svg has been converted to icon.png (128x128)
- Place icon.png in root of SqlPackage.Publisher directory
- Verify task.json references correct icon path

## Development Workflow

1. Make changes to `index.ts`
2. Run `npm run lint` to check code quality
3. Run `npm test` to ensure tests pass
4. Update version numbers (if needed)
5. Run `npm run package` to create VSIX
6. Test VSIX in Azure DevOps
7. Commit and push to develop branch
8. GitHub Actions automatically builds and publishes
