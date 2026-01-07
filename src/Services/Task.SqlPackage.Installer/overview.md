# SqlPackage Installer for Azure Pipelines

Install SqlPackage command-line utility in your Azure DevOps pipeline with this simple task. Works on Windows, Linux, and macOS agents.

Installing this extension **DOES NOT** make SqlPackage available for the Microsoft SQL Deployment task because that task is hardcoded to search for the binaries on the Windows Registry, which requires system-wide changes outside of the scope (and conflicting with the purpose) of this task.

This task is intended to be used with the [SqlPackage Publisher](https://marketplace.visualstudio.com/items?itemName=pedroc88.sqlpackage-publisher) companion task, or on systems with SqlPackage pre-installed and available on PATH.

## 🚀 Quick Start

```yaml
- task: SqlPackageInstaller@1
  inputs:
    versionSpec: 'latest'
```

Then use SqlPackage in your pipeline:

```yaml
- script: sqlpackage /Action:Publish /SourceFile:app.dacpac /TargetServerName:$(Server)
  displayName: 'Deploy Database'
```

## ✨ Features

- **Cross-Platform** - Windows, Linux, and macOS support
- **Smart Caching** - Downloads once, reuses across pipeline runs
- **Version Control** - Use 'latest' or pin to specific versions
- **Zero Config** - Works immediately with sensible defaults

## 📋 Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `versionSpec` | Version to install (e.g., 'latest', '162.0.52.1') | `latest` |
| `checkLatest` | Always check for latest version | `false` |
| `installDirectory` | Custom installation directory | Tool cache |

## 📖 Usage Examples

### Latest Version (Recommended)

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

## 🔧 Complete Pipeline Example

```yaml
trigger:
  - main

pool:
  vmImage: 'ubuntu-latest'

steps:
  - task: SqlPackageInstaller@1
    displayName: 'Install SqlPackage'
    inputs:
      versionSpec: 'latest'

  - script: |
      sqlpackage /Action:Publish \
        /SourceFile:MyDatabase.dacpac \
        /TargetServerName:$(DatabaseServer) \
        /TargetDatabaseName:$(DatabaseName)
    displayName: 'Deploy Database'
```

## 🌐 Platform Support

| Platform | Status |
|----------|--------|
| Windows (x64) | ✅ Supported |
| Linux (x64) | ✅ Supported |
| macOS (x64) | ✅ Supported |

## 🛠️ Common SqlPackage Actions

- **Publish** - Deploy a .dacpac to a database
- **Extract** - Create a .dacpac from a database
- **Export** - Export data to .bacpac
- **Import** - Import data from .bacpac
- **Script** - Generate deployment SQL scripts
- **DeployReport** - Preview changes without deploying

## ❓ Troubleshooting

### Command not found

Ensure the installer runs before using sqlpackage:

```yaml
- task: SqlPackageInstaller@1  # Must run first
- script: sqlpackage /version   # Now available
```

### Enable Debug Logging

```yaml
variables:
  System.Debug: true
```

## 📚 Resources

- [Source Code](https://github.com/PedroC88/Azure-pipelines-tasks)
- [Report Issues](https://github.com/PedroC88/Azure-pipelines-tasks/issues)
- [SqlPackage Documentation](https://docs.microsoft.com/sql/tools/sqlpackage)

## 📄 License

Custom non-commercial license - free for personal use. See [LICENSE](https://github.com/PedroC88/Azure-pipelines-tasks/blob/develop/LICENSE) for details.

---

**Note**: This is an independent community project and is not officially affiliated with Microsoft.
