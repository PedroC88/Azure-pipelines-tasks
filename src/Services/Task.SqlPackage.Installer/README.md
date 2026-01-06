# SqlPackage Installer

[![Build Status](https://github.com/PedroC88/Azure-pipelines-tasks/workflows/Build%20and%20Publish/badge.svg)](https://github.com/PedroC88/Azure-pipelines-tasks/actions)
[![License](https://img.shields.io/badge/license-Custom-blue.svg)](LICENSE)

Azure DevOps task that installs SqlPackage and adds it to your pipeline PATH. SqlPackage is a command-line utility that automates database development tasks for SQL Server, Azure SQL Database, and Azure SQL Data Warehouse.

## Features

✅ **Cross-Platform Support** - Works on Windows, Linux, and macOS agents
✅ **Version Flexibility** - Install latest version or pin to specific releases
✅ **Smart Caching** - Downloads once, reuses cached versions across pipeline runs
✅ **Zero Configuration** - Works out of the box with sensible defaults
✅ **GitHub Actions Compatible** - Tested with modern CI/CD workflows

## Quick Start

Add this task to your Azure Pipeline to install SqlPackage:

```yaml
- task: SqlPackageInstaller@1
  inputs:
    versionSpec: 'latest'
```

Then use SqlPackage in subsequent steps:

```yaml
- script: sqlpackage /Action:Publish /SourceFile:app.dacpac /TargetServerName:$(ServerName)
  displayName: 'Deploy Database'
```

## What It Does

1. **Checks Cache** - Looks for SqlPackage in the tools cache
2. **Downloads** - Fetches the requested version from Microsoft's official release
3. **Extracts** - Unpacks the tools to a working directory
4. **Caches** - Stores for future pipeline runs
5. **Adds to PATH** - Makes `sqlpackage` command available globally

## Input Parameters

| Parameter | Description | Default | Required |
|-----------|-------------|---------|----------|
| `versionSpec` | Version to install (e.g., 'latest', '162.0.52.1') | `latest` | Yes |
| `checkLatest` | Always check for latest version, even if cached | `false` | No |
| `installDirectory` | Custom installation directory (optional) | Tool cache | No |

## Usage Examples

### Latest Version
```yaml
- task: SqlPackageInstaller@1
  inputs:
    versionSpec: 'latest'
```

### Specific Version
```yaml
- task: SqlPackageInstaller@1
  inputs:
    versionSpec: '162.0.52.1'
```

### Always Use Latest (Skip Cache)
```yaml
- task: SqlPackageInstaller@1
  inputs:
    versionSpec: 'latest'
    checkLatest: true
```

### Custom Installation Directory
```yaml
- task: SqlPackageInstaller@1
  inputs:
    versionSpec: 'latest'
    installDirectory: '$(Agent.ToolsDirectory)/sqlpackage'
```

## Complete Pipeline Example

```yaml
trigger:
  branches:
    include:
      - main

pool:
  vmImage: 'ubuntu-latest'

steps:
  - task: SqlPackageInstaller@1
    displayName: 'Install SqlPackage'
    inputs:
      versionSpec: 'latest'

  - task: UseDotNet@2
    displayName: 'Install .NET SDK'
    inputs:
      version: '8.x'

  - script: |
      dotnet build MyDatabase.sqlproj
    displayName: 'Build Database Project'

  - script: |
      sqlpackage /Action:Publish \
        /SourceFile:bin/Debug/MyDatabase.dacpac \
        /TargetServerName:$(DatabaseServer) \
        /TargetDatabaseName:$(DatabaseName) \
        /TargetUser:$(DatabaseUser) \
        /TargetPassword:$(DatabasePassword)
    displayName: 'Deploy to SQL Server'
```

## Platform Support

| Platform | Supported | Tested |
|----------|-----------|--------|
| Windows (x64) | ✅ | ✅ |
| Linux (x64) | ✅ | ✅ |
| macOS (x64) | ✅ | ✅ |

## Common SqlPackage Actions

Once installed, SqlPackage supports these common actions:

- **Publish** - Deploy a .dacpac file to a database
- **Extract** - Create a .dacpac from an existing database
- **Export** - Export data to a .bacpac file
- **Import** - Import data from a .bacpac file
- **Script** - Generate SQL scripts for database changes
- **DeployReport** - Generate a deployment report without making changes

## Troubleshooting

### SqlPackage not found
Ensure the task runs before attempting to use sqlpackage:
```yaml
- task: SqlPackageInstaller@1
- script: sqlpackage /version  # Should work now
```

### Version not available
Check available versions at: https://github.com/microsoft/DacFx/releases

### Permission errors on Linux/macOS
The task automatically sets execute permissions on Unix systems.

## Development

### Building from Source
```bash
cd src/Services/Task.SqlPackage.Installer
npm install
npm run build
npm test
```

### Creating VSIX Package
```bash
npm run package
```

This generates `PedroC88.sqlpackage-installer-{version}.vsix`

### Running Tests
```bash
npm test           # Run all tests
npm run test:watch # Watch mode
npm run lint       # Lint code
```

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

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

This project is licensed under a custom non-commercial license. See [LICENSE](LICENSE) for details.

## Links

- **Source Code**: https://github.com/PedroC88/Azure-pipelines-tasks
- **Issues**: https://github.com/PedroC88/Azure-pipelines-tasks/issues
- **SqlPackage Documentation**: https://docs.microsoft.com/sql/tools/sqlpackage
- **Detailed Documentation**: [docs/](docs/)

## Support

For issues and questions:
- Open an issue on [GitHub](https://github.com/PedroC88/Azure-pipelines-tasks/issues)
- Check [SqlPackage official documentation](https://docs.microsoft.com/sql/tools/sqlpackage)

---

**Note**: This is an independent community project and is not officially affiliated with Microsoft.

## More Information

See [docs/](docs/) for detailed documentation:
- Architecture & Design
- Build Process
- Troubleshooting
- Version History