# Usage Examples

## Basic Usage

### Deploy with Windows Authentication
```yaml
steps:
- task: SqlPackagePublisher@0
  inputs:
    dacpacFile: '$(Build.SourcesDirectory)/Database.dacpac'
    targetMethod: 'server'
    serverName: 'myserver'
    databaseName: 'MyDatabase'
    authenticationType: 'windowsAuthentication'
```

### Deploy with SQL Authentication
```yaml
steps:
- task: SqlPackagePublisher@0
  inputs:
    dacpacFile: '$(Build.SourcesDirectory)/Database.dacpac'
    targetMethod: 'server'
    serverName: 'myserver.database.windows.net'
    databaseName: 'MyDatabase'
    authenticationType: 'sqlServerAuthentication'
    sqlUsername: 'sqladmin'
    sqlPassword: '$(SqlPassword)'  # Use secret variable
```

### Deploy with Azure AD Authentication
```yaml
steps:
- task: SqlPackagePublisher@0
  inputs:
    dacpacFile: '$(Build.SourcesDirectory)/Database.dacpac'
    targetMethod: 'server'
    serverName: 'myserver.database.windows.net'
    databaseName: 'MyDatabase'
    authenticationType: 'azureActiveDirectory'
```

### Deploy with Connection String
```yaml
steps:
- task: SqlPackagePublisher@0
  inputs:
    dacpacFile: '$(Build.SourcesDirectory)/Database.dacpac'
    targetMethod: 'connectionString'
    connectionString: 'Server=myserver;Database=MyDatabase;User Id=sa;Password=$(SqlPassword)'
```

---

## Common Scenarios

### Install SqlPackage First
```yaml
steps:
- task: SqlPackageInstaller@1
  displayName: 'Install SqlPackage'
  inputs:
    versionSpec: 'latest'

- task: SqlPackagePublisher@0
  displayName: 'Deploy Database'
  inputs:
    dacpacFile: '$(Build.SourcesDirectory)/Database.dacpac'
    serverName: '$(DatabaseServer)'
    databaseName: '$(DatabaseName)'
    authenticationType: 'sqlServerAuthentication'
    sqlUsername: '$(DatabaseUser)'
    sqlPassword: '$(DatabasePassword)'
```

### Deploy with Publish Profile
```yaml
steps:
- task: SqlPackagePublisher@0
  inputs:
    dacpacFile: '$(Build.SourcesDirectory)/Database.dacpac'
    serverName: 'myserver'
    databaseName: 'MyDatabase'
    authenticationType: 'windowsAuthentication'
    publishProfile: '$(Build.SourcesDirectory)/Database.publish.xml'
```

### Deploy with Additional Arguments
```yaml
steps:
- task: SqlPackagePublisher@0
  inputs:
    dacpacFile: '$(Build.SourcesDirectory)/Database.dacpac'
    serverName: 'myserver'
    databaseName: 'MyDatabase'
    authenticationType: 'windowsAuthentication'
    additionalArguments: |
      /p:BlockOnPossibleDataLoss=false
      /p:DropObjectsNotInSource=true
      /p:IgnorePermissions=true
```

---

## CI/CD Pipeline

### Complete Database Deployment
```yaml
trigger:
- main

pool:
  vmImage: 'windows-latest'

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

- task: SqlPackagePublisher@0
  displayName: 'Deploy Database'
  inputs:
    dacpacFile: '$(Build.SourcesDirectory)/Database/bin/Debug/Database.dacpac'
    targetMethod: 'server'
    serverName: '$(DatabaseServer)'
    databaseName: '$(DatabaseName)'
    authenticationType: 'sqlServerAuthentication'
    sqlUsername: '$(DatabaseUser)'
    sqlPassword: '$(DatabasePassword)'
```

---

## Multi-Stage Deployment

### Deploy to Multiple Environments
```yaml
stages:
- stage: Build
  displayName: 'Build Stage'
  jobs:
  - job: BuildDatabase
    steps:
    - task: SqlPackageInstaller@1
      inputs:
        versionSpec: 'latest'

    - task: DotNetCoreCLI@2
      inputs:
        command: 'build'
        projects: '**/Database.sqlproj'

    - task: PublishBuildArtifacts@1
      inputs:
        PathtoPublish: '$(Build.SourcesDirectory)/Database/bin/Debug'
        ArtifactName: 'database'

- stage: DeployDev
  displayName: 'Deploy to Development'
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
              versionSpec: 'latest'

          - task: SqlPackagePublisher@0
            inputs:
              dacpacFile: '$(Pipeline.Workspace)/database/Database.dacpac'
              serverName: '$(DevServer)'
              databaseName: '$(DevDatabase)'
              authenticationType: 'sqlServerAuthentication'
              sqlUsername: '$(DevUser)'
              sqlPassword: '$(DevPassword)'

- stage: DeployQA
  displayName: 'Deploy to QA'
  dependsOn: DeployDev
  jobs:
  - deployment: DeployDatabase
    environment: 'QA'
    strategy:
      runOnce:
        deploy:
          steps:
          - task: SqlPackageInstaller@1
            inputs:
              versionSpec: 'latest'

          - task: SqlPackagePublisher@0
            inputs:
              dacpacFile: '$(Pipeline.Workspace)/database/Database.dacpac'
              serverName: '$(QAServer)'
              databaseName: '$(QADatabase)'
              authenticationType: 'sqlServerAuthentication'
              sqlUsername: '$(QAUser)'
              sqlPassword: '$(QAPassword)'

- stage: DeployProd
  displayName: 'Deploy to Production'
  dependsOn: DeployQA
  jobs:
  - deployment: DeployDatabase
    environment: 'Production'
    strategy:
      runOnce:
        deploy:
          steps:
          - task: SqlPackageInstaller@1
            inputs:
              versionSpec: 'latest'

          - task: SqlPackagePublisher@0
            inputs:
              dacpacFile: '$(Pipeline.Workspace)/database/Database.dacpac'
              serverName: '$(ProdServer)'
              databaseName: '$(ProdDatabase)'
              authenticationType: 'azureActiveDirectory'
              additionalArguments: |
                /p:BlockOnPossibleDataLoss=true
                /p:BackupDatabaseBeforeChanges=true
```

---

## Advanced Configuration

### Conditional Deployment
```yaml
- task: SqlPackagePublisher@0
  condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/main'))
  inputs:
    dacpacFile: '$(Build.SourcesDirectory)/Database.dacpac'
    serverName: '$(ProductionServer)'
    databaseName: '$(ProductionDatabase)'
    authenticationType: 'azureActiveDirectory'
```

### Retry on Failure
```yaml
- task: SqlPackagePublisher@0
  retryCountOnTaskFailure: 3
  inputs:
    dacpacFile: '$(Build.SourcesDirectory)/Database.dacpac'
    serverName: '$(DatabaseServer)'
    databaseName: '$(DatabaseName)'
    authenticationType: 'sqlServerAuthentication'
    sqlUsername: '$(DatabaseUser)'
    sqlPassword: '$(DatabasePassword)'
```

### Continue on Error
```yaml
- task: SqlPackagePublisher@0
  continueOnError: true
  inputs:
    dacpacFile: '$(Build.SourcesDirectory)/Database.dacpac'
    serverName: '$(DatabaseServer)'
    databaseName: '$(DatabaseName)'
    authenticationType: 'windowsAuthentication'
```

---

## Cross-Platform

### Windows Agent
```yaml
pool:
  vmImage: 'windows-latest'

steps:
- task: SqlPackageInstaller@1

- task: SqlPackagePublisher@0
  inputs:
    dacpacFile: '$(Build.SourcesDirectory)/Database.dacpac'
    serverName: 'myserver'
    databaseName: 'MyDatabase'
    authenticationType: 'windowsAuthentication'
```

### Linux Agent
```yaml
pool:
  vmImage: 'ubuntu-latest'

steps:
- task: SqlPackageInstaller@1

- task: SqlPackagePublisher@0
  inputs:
    dacpacFile: '$(Build.SourcesDirectory)/Database.dacpac'
    serverName: 'myserver.database.windows.net'
    databaseName: 'MyDatabase'
    authenticationType: 'sqlServerAuthentication'
    sqlUsername: '$(DatabaseUser)'
    sqlPassword: '$(DatabasePassword)'
```

### macOS Agent
```yaml
pool:
  vmImage: 'macOS-latest'

steps:
- task: SqlPackageInstaller@1

- task: SqlPackagePublisher@0
  inputs:
    dacpacFile: '$(Build.SourcesDirectory)/Database.dacpac'
    serverName: 'myserver.database.windows.net'
    databaseName: 'MyDatabase'
    authenticationType: 'sqlServerAuthentication'
    sqlUsername: '$(DatabaseUser)'
    sqlPassword: '$(DatabasePassword)'
```

---

## Variable Groups

### Using Library Variables
```yaml
variables:
- group: DatabaseCredentials-Dev

steps:
- task: SqlPackagePublisher@0
  inputs:
    dacpacFile: '$(Build.SourcesDirectory)/Database.dacpac'
    serverName: '$(DB_Server)'
    databaseName: '$(DB_Name)'
    authenticationType: 'sqlServerAuthentication'
    sqlUsername: '$(DB_User)'
    sqlPassword: '$(DB_Password)'
```

### Environment-Specific Variables
```yaml
variables:
- ${{ if eq(variables['Build.SourceBranchName'], 'develop') }}:
  - group: DatabaseCredentials-Dev
- ${{ if eq(variables['Build.SourceBranchName'], 'main') }}:
  - group: DatabaseCredentials-Prod

steps:
- task: SqlPackagePublisher@0
  inputs:
    dacpacFile: '$(Build.SourcesDirectory)/Database.dacpac'
    serverName: '$(DB_Server)'
    databaseName: '$(DB_Name)'
    authenticationType: 'sqlServerAuthentication'
    sqlUsername: '$(DB_User)'
    sqlPassword: '$(DB_Password)'
```

---

## Best Practices

### 1. Always Use Secret Variables
```yaml
variables:
  DatabasePassword: $(SecretPassword)  # Mark as secret in pipeline

steps:
- task: SqlPackagePublisher@0
  inputs:
    sqlPassword: '$(DatabasePassword)'
```

### 2. Enable Debug for Troubleshooting
```yaml
variables:
  System.Debug: true

steps:
- task: SqlPackagePublisher@0
  inputs:
    dacpacFile: '$(Build.SourcesDirectory)/Database.dacpac'
```

### 3. Use Publish Profiles for Complex Deployments
Store deployment settings in `.publish.xml` instead of pipeline YAML.

### 4. Validate DACPAC Before Deployment
```yaml
- script: |
    sqlpackage /Action:DeployReport \
      /SourceFile:Database.dacpac \
      /TargetServerName:$(Server) \
      /TargetDatabaseName:$(Database) \
      /OutputPath:deploy-report.xml
  displayName: 'Generate Deploy Report'

- task: SqlPackagePublisher@0
  displayName: 'Deploy Database'
```

### 5. Backup Before Production Deployments
```yaml
- task: SqlPackagePublisher@0
  inputs:
    additionalArguments: |
      /p:BackupDatabaseBeforeChanges=true
      /p:BlockOnPossibleDataLoss=true
```
