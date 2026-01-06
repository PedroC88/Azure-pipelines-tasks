# SqlPackage Publisher Task

Azure Pipelines task to deploy SQL Server DACPAC files using SqlPackage. Cross-platform support for Windows, Linux, and macOS agents.

## Features

- Deploy DACPAC files to SQL Server databases
- Multiple authentication methods (Windows, SQL Server, Azure AD)
- Support for publish profiles
- Cross-platform (Windows, Linux, macOS)
- Custom SqlPackage arguments

## Usage

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

UNLICENSED - Custom non-commercial license
