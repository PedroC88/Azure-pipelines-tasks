# Usage Examples

## Basic Usage

### Install Latest Version
```yaml
steps:
- task: SqlPackageInstaller@1
  inputs:
    versionSpec: 'latest'
```

### Install Specific Version
```yaml
steps:
- task: SqlPackageInstaller@1
  inputs:
    versionSpec: '162.0.52.1'
```

---

## Common Scenarios

### Export Database
```yaml
steps:
- task: SqlPackageInstaller@1

- script: |
    sqlpackage /Action:Export \
      /SourceServerName:$(ServerName) \
      /SourceDatabaseName:$(DatabaseName) \
      /TargetFile:$(Build.ArtifactStagingDirectory)/backup.bacpac
  displayName: 'Export Database'
```

### Publish DACPAC
```yaml
steps:
- task: SqlPackageInstaller@1

- script: |
    sqlpackage /Action:Publish \
      /SourceFile:Database.dacpac \
      /TargetServerName:$(TargetServer) \
      /TargetDatabaseName:$(TargetDatabase)
  displayName: 'Deploy Database'
```

### Extract Schema
```yaml
steps:
- task: SqlPackageInstaller@1

- script: |
    sqlpackage /Action:Extract \
      /SourceServerName:$(Server) \
      /SourceDatabaseName:$(Database) \
      /TargetFile:schema.dacpac
  displayName: 'Extract Schema'
```

---

## CI/CD Pipeline

### Complete Database Deployment
```yaml
trigger:
- main

pool:
  vmImage: 'ubuntu-latest'

variables:
  DatabaseServer: 'myserver.database.windows.net'
  DatabaseName: 'MyDatabase'

steps:
- task: SqlPackageInstaller@1
  displayName: 'Install SqlPackage'
  inputs:
    versionSpec: 'latest'

- task: DotNetCoreCLI@2
  displayName: 'Build Database Project'
  inputs:
    command: 'build'
    projects: '**/Database.sqlproj'

- task: CmdLine@2
  displayName: 'Deploy Database'
  inputs:
    script: |
      sqlpackage /Action:Publish \
        /SourceFile:$(Build.SourcesDirectory)/Database/bin/Database.dacpac \
        /TargetServerName:$(DatabaseServer) \
        /TargetDatabaseName:$(DatabaseName) \
        /TargetUser:$(DatabaseUser) \
        /TargetPassword:$(DatabasePassword)
```

---

## Multi-Stage Pipeline

### Build Once, Deploy Many
```yaml
stages:
- stage: Build
  displayName: 'Build Stage'
  jobs:
  - job: BuildDatabase
    steps:
    - task: SqlPackageInstaller@1
      inputs:
        versionSpec: '162.0.52.1'

    - task: DotNetCoreCLI@2
      inputs:
        command: 'build'
        projects: '**/Database.sqlproj'

    - task: PublishBuildArtifacts@1
      inputs:
        PathtoPublish: '$(Build.SourcesDirectory)/Database/bin'
        ArtifactName: 'database'

- stage: DeployDev
  displayName: 'Deploy to Dev'
  dependsOn: Build
  jobs:
  - deployment: DeployDatabase
    environment: 'Development'
    strategy:
      runOnce:
        deploy:
          steps:
          - task: SqlPackageInstaller@1
            inputs:
              versionSpec: '162.0.52.1'

          - script: |
              sqlpackage /Action:Publish \
                /SourceFile:$(Pipeline.Workspace)/database/Database.dacpac \
                /TargetServerName:$(DevServer) \
                /TargetDatabaseName:$(DevDatabase)

- stage: DeployProd
  displayName: 'Deploy to Production'
  dependsOn: DeployDev
  jobs:
  - deployment: DeployDatabase
    environment: 'Production'
    strategy:
      runOnce:
        deploy:
          steps:
          - task: SqlPackageInstaller@1
            inputs:
              versionSpec: '162.0.52.1'

          - script: |
              sqlpackage /Action:Publish \
                /SourceFile:$(Pipeline.Workspace)/database/Database.dacpac \
                /TargetServerName:$(ProdServer) \
                /TargetDatabaseName:$(ProdDatabase)
```

---

## Advanced Configuration

### Custom Installation Directory
```yaml
- task: SqlPackageInstaller@1
  inputs:
    versionSpec: 'latest'
    installDirectory: '$(Agent.ToolsDirectory)/CustomPath/SqlPackage'
```

### Always Check for Latest
```yaml
- task: SqlPackageInstaller@1
  inputs:
    versionSpec: 'latest'
    checkLatest: true
```

### Debug Mode
```yaml
variables:
  System.Debug: true

steps:
- task: SqlPackageInstaller@1
  inputs:
    versionSpec: 'latest'
```

---

## Cross-Platform

### Windows Agent
```yaml
pool:
  vmImage: 'windows-latest'

steps:
- task: SqlPackageInstaller@1

- powershell: |
    sqlpackage /Action:Publish /SourceFile:app.dacpac /TargetServerName:$(Server)
```

### Linux Agent
```yaml
pool:
  vmImage: 'ubuntu-latest'

steps:
- task: SqlPackageInstaller@1

- bash: |
    sqlpackage /Action:Publish /SourceFile:app.dacpac /TargetServerName:$(Server)
```

### macOS Agent
```yaml
pool:
  vmImage: 'macOS-latest'

steps:
- task: SqlPackageInstaller@1

- bash: |
    sqlpackage /Action:Publish /SourceFile:app.dacpac /TargetServerName:$(Server)
```

---

## Using Output Variables

```yaml
- task: SqlPackageInstaller@1
  name: InstallSqlPackage
  inputs:
    versionSpec: 'latest'

- script: |
    echo "SqlPackage installed at: $(InstallSqlPackage.SqlPackageRoot)"
    echo "Version: $(sqlpackage /version)"
  displayName: 'Show Installation Info'
```

---

## With Service Connections

```yaml
- task: SqlPackageInstaller@1

- task: AzureCLI@2
  inputs:
    azureSubscription: 'MyServiceConnection'
    scriptType: 'bash'
    scriptLocation: 'inlineScript'
    inlineScript: |
      sqlpackage /Action:Publish \
        /SourceFile:app.dacpac \
        /TargetServerName:$(Server) \
        /AccessToken:$(az account get-access-token --resource=https://database.windows.net --query accessToken -o tsv)
```
