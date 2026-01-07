# SqlPackage Publisher for Azure Pipelines

Deploy SQL Server DACPAC files using SqlPackage command-line utility. Cross-platform support for Windows, Linux, and macOS agents.

## 📄 License

Custom non-commercial license - free for personal use. See [LICENSE](https://github.com/PedroC88/Azure-pipelines-tasks/blob/develop/LICENSE) for details.

## 🚀 Quick Start

```yaml
- task: SqlPackageInstaller@1
  inputs:
    versionSpec: 'latest'

- task: SqlPackagePublisher@0
  inputs:
    dacpacFile: '$(System.DefaultWorkingDirectory)/**/*.dacpac'
    serverName: '$(SqlServer)'
    databaseName: '$(DatabaseName)'
    authenticationType: 'sqlServerAuthentication'
    sqlUsername: '$(SqlUser)'
    sqlPassword: '$(SqlPassword)'
```

## ✨ Features

- **Cross-Platform** - Works on Windows, Linux, and macOS agents
- **Multiple Authentication** - Windows, SQL Server, and Azure Active Directory
- **Publish Profiles** - Support for XML publish profile files
- **Connection Strings** - Direct connection string support
- **Flexible Configuration** - Additional SqlPackage arguments support

## 📋 Parameters

| Parameter | Description | Required | Default |
|-----------|-------------|----------|---------|
| `dacpacFile` | Path to the DACPAC file | ✅ | - |
| `targetMethod` | Connection method: server or connectionString | ✅ | server |
| `serverName` | SQL Server name or address | ✅ (if server) | - |
| `databaseName` | Target database name | ✅ (if server) | - |
| `authenticationType` | Authentication method | ✅ | windowsAuthentication |
| `sqlUsername` | SQL username | ✅ (if SQL auth) | - |
| `sqlPassword` | SQL password (use secret variable) | ✅ (if SQL auth) | - |
| `connectionString` | Full connection string | ✅ (if connectionString) | - |
| `publishProfile` | Path to .publish.xml profile | ❌ | - |
| `additionalArguments` | Extra SqlPackage arguments | ❌ | - |

## 📖 Usage Examples

### Windows Authentication

```yaml
- task: SqlPackagePublisher@0
  inputs:
    dacpacFile: '$(Build.ArtifactStagingDirectory)/MyDatabase.dacpac'
    serverName: 'localhost'
    databaseName: 'MyDatabase'
    authenticationType: 'windowsAuthentication'
```

### SQL Server Authentication

```yaml
- task: SqlPackagePublisher@0
  inputs:
    dacpacFile: '**/*.dacpac'
    serverName: 'myserver.database.windows.net'
    databaseName: 'MyDatabase'
    authenticationType: 'sqlServerAuthentication'
    sqlUsername: '$(SqlAdmin)'
    sqlPassword: '$(SqlAdminPassword)'
```

### With Publish Profile

```yaml
- task: SqlPackagePublisher@0
  inputs:
    dacpacFile: 'MyDatabase.dacpac'
    serverName: '$(SqlServer)'
    databaseName: '$(DatabaseName)'
    authenticationType: 'sqlServerAuthentication'
    sqlUsername: '$(SqlUser)'
    sqlPassword: '$(SqlPassword)'
    publishProfile: 'MyDatabase.publish.xml'
```

### With Additional Arguments

```yaml
- task: SqlPackagePublisher@0
  inputs:
    dacpacFile: 'MyDatabase.dacpac'
    serverName: 'localhost'
    databaseName: 'MyDatabase'
    authenticationType: 'windowsAuthentication'
    additionalArguments: |
      /p:BlockOnPossibleDataLoss=false
      /p:DropObjectsNotInSource=true
      /p:IgnorePermissions=true
```

### Using Connection String

```yaml
- task: SqlPackagePublisher@0
  inputs:
    dacpacFile: 'MyDatabase.dacpac'
    targetMethod: 'connectionString'
    connectionString: 'Server=myserver;Database=MyDatabase;User Id=sa;Password=$(Password);'
```

## 🔧 Complete Pipeline Example

```yaml
trigger:
  - main

pool:
  vmImage: 'windows-latest'

variables:
  - group: sql-credentials

steps:
  - task: SqlPackageInstaller@1
    displayName: 'Install SqlPackage'
    inputs:
      versionSpec: 'latest'

  - task: DownloadBuildArtifacts@0
    displayName: 'Download DACPAC'
    inputs:
      buildType: 'current'
      downloadType: 'single'
      artifactName: 'dacpac'
      downloadPath: '$(System.ArtifactsDirectory)'

  - task: SqlPackagePublisher@0
    displayName: 'Deploy Database'
    inputs:
      dacpacFile: '$(System.ArtifactsDirectory)/dacpac/*.dacpac'
      serverName: '$(SqlServerName)'
      databaseName: '$(DatabaseName)'
      authenticationType: 'sqlServerAuthentication'
      sqlUsername: '$(SqlUsername)'
      sqlPassword: '$(SqlPassword)'
      additionalArguments: '/p:BlockOnPossibleDataLoss=false'
```

## 🌐 Platform Support

| Platform | Status |
|----------|--------|
| Windows (x64) | ✅ Supported |
| Linux (x64) | ✅ Supported |
| macOS (x64) | ✅ Supported |

## 🛠️ Common SqlPackage Properties

Use in `additionalArguments` field:

- `/p:BlockOnPossibleDataLoss=false` - Allow data loss during deployment
- `/p:DropObjectsNotInSource=true` - Drop objects not in the DACPAC
- `/p:IgnorePermissions=true` - Ignore permission differences
- `/p:IgnoreUserSettingsObjects=true` - Ignore user-specific objects
- `/p:BackupDatabaseBeforeChanges=true` - Backup before deployment
- `/p:CreateNewDatabase=true` - Create database if it doesn't exist

## ❓ Troubleshooting

### SqlPackage not found

Ensure the SqlPackage Installer task runs before the publisher:

```yaml
- task: SqlPackageInstaller@1  # Must run first
- task: SqlPackagePublisher@0  # Then deploy
```

### Authentication Failed

For Azure SQL Database with SQL authentication, ensure:
- Server name includes `.database.windows.net`
- Firewall rules allow the agent's IP address
- Password is stored in a secret variable

### Connection Timeout

Add timeout parameter:
```yaml
additionalArguments: '/p:CommandTimeout=300'
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
- [SqlPackage Publish Parameters](https://docs.microsoft.com/sql/tools/sqlpackage/sqlpackage-publish)

---

**Note**: This is an independent community project and is not officially affiliated with Microsoft.
