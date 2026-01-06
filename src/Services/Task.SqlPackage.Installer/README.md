# SqlPackage Installer

Azure DevOps task that installs SqlPackage and adds it to your pipeline PATH.

## Quick Start

```yaml
- task: SqlPackageInstaller@1
  inputs:
    versionSpec: 'latest'
```

## What It Does

- Downloads and caches SqlPackage tools
- Adds SqlPackage to PATH for subsequent tasks
- Supports Windows, Linux, and macOS
- Works with specific versions or 'latest'

## Installation

```bash
npm install
npm run package
```

Upload the generated `.vsix` file to Azure DevOps.

## Usage Examples

**Latest version:**
```yaml
- task: SqlPackageInstaller@1
  inputs:
    versionSpec: 'latest'
```

**Specific version:**
```yaml
- task: SqlPackageInstaller@1
  inputs:
    versionSpec: '162.0.52.1'
```

**Use in pipeline:**
```yaml
- task: SqlPackageInstaller@1

- script: sqlpackage /Action:Publish /SourceFile:app.dacpac /TargetServerName:$(Server)
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `versionSpec` | Yes | `latest` | SqlPackage version |
| `checkLatest` | No | `false` | Check for latest version online |
| `installDirectory` | No | (cache) | Custom install path |

## Outputs

- `SqlPackageRoot` - Installation directory path

## Platforms

- Windows (x64)
- Linux (x64)
- macOS (x64)

## Caching

Downloaded versions are cached automatically:
- First use: downloads and caches
- Subsequent uses: instant from cache
- Cache shared across all pipelines on agent

## Debugging

Enable verbose logging:
```yaml
variables:
  System.Debug: true
```

## More Information

See [docs/](docs/) for detailed documentation:
- Architecture & Design
- Build Process
- Troubleshooting
- Version History