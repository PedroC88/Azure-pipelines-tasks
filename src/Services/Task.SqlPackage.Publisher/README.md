# SqlPackage Publisher Task

Azure Pipelines task to deploy SQL Server DACPAC files using SqlPackage or execute SQL scripts using sqlcmd. Cross-platform support for Windows, Linux, and macOS agents.

## Features

- Deploy DACPAC files to SQL Server databases
- Execute SQL script files or inline SQL
- Multiple authentication methods (Windows, SQL Server, Azure AD, Entra Integrated via Service Connections)
- Support for publish profiles
- Cross-platform (Windows, Linux, macOS)
- Custom SqlPackage arguments
- Separate SqlPackage and sqlcmd argument inputs

## Usage

### Execute a SQL Script File

Install the companion SqlCmd task first:

```yaml
- task: SqlCmdInstaller@1
  inputs:
    versionSpec: latest

- task: SqlPackagePublisher@1
  inputs:
    taskNameSelector: SqlTask
    sqlFile: '$(Build.SourcesDirectory)/Database/seed.sql'
    targetMethod: server
    serverName: '$(SqlServer)'
    databaseName: '$(DatabaseName)'
    authenticationType: sqlServerAuthentication
    sqlUsername: '$(SqlUser)'
    sqlPassword: '$(SqlPassword)'
    sqlAdditionalArguments: '-t 300'
```

### Execute Inline SQL

```yaml
- task: SqlCmdInstaller@1
  inputs:
    versionSpec: latest

- task: SqlPackagePublisher@1
  inputs:
    taskNameSelector: InlineSqlTask
    sqlInline: |
      IF OBJECT_ID('dbo.SeedStatus') IS NULL
      BEGIN
        CREATE TABLE dbo.SeedStatus (Id int NOT NULL);
      END
      GO
    serverName: '$(SqlServer)'
    databaseName: '$(DatabaseName)'
    authenticationType: sqlServerAuthentication
    sqlUsername: '$(SqlUser)'
    sqlPassword: '$(SqlPassword)'
    inlineAdditionalArguments: '-t 300'
```

SQL script modes run `sqlcmd` (the cross-platform go-sqlcmd executable), so install it using `SqlCmdInstaller@1` or make it available on PATH. Script arguments use sqlcmd options; DACPAC `additionalArguments` continue to use SqlPackage options.

### Using Entra Integrated Authentication (Service Connection)

```yaml
- task: SqlPackageInstaller@1
  inputs:
    versionSpec: 'latest'

- task: SqlPackagePublisher@0
  inputs:
    dacpacFile: '$(System.DefaultWorkingDirectory)/**/*.dacpac'
    serverName: '$(SqlServer)'
    databaseName: '$(DatabaseName)'
    authenticationType: 'entraIntegrated'
    azureSubscription: 'MyAzureServiceConnection'
```

### Using SQL Server Authentication

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

## Development

```bash
npm install
npm run build
npm test
npm run package
```

## License

MIT
