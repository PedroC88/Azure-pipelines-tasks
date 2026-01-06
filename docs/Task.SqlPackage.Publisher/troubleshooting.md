# Troubleshooting

## Common Issues

### "DACPAC file path is required"

**Cause:** The `dacpacFile` input is empty or not provided.

**Solution:**
1. Verify the DACPAC file path is correct
2. Use a valid file path variable: `$(Build.SourcesDirectory)/Database.dacpac`
3. Ensure the file path input is specified in the task

### "DACPAC file not found at path: [path]"

**Cause:** The specified DACPAC file doesn't exist at the given path.

**Solution:**
1. Check that the build step created the DACPAC successfully
2. Verify the path is correct (check slashes: `/` vs `\`)
3. List directory contents before deployment:
   ```yaml
   - script: ls -la $(Build.SourcesDirectory)
   ```
4. Ensure the file extension is `.dacpac`

### "SqlPackage not found in PATH"

**Cause:** SqlPackage is not installed or not in the system PATH.

**Solution:**
Add SqlPackage Installer task before the Publisher task:
```yaml
steps:
- task: SqlPackageInstaller@1
  displayName: 'Install SqlPackage'
  inputs:
    versionSpec: 'latest'

- task: SqlPackagePublisher@0
  displayName: 'Deploy Database'
```

### "Server name and database name are required"

**Cause:** Using `targetMethod: 'server'` but server or database name is missing.

**Solution:**
Provide both server and database names:
```yaml
- task: SqlPackagePublisher@0
  inputs:
    targetMethod: 'server'
    serverName: 'myserver.database.windows.net'
    databaseName: 'MyDatabase'
```

### "Connection string is required when using connectionString method"

**Cause:** Using `targetMethod: 'connectionString'` but connection string is empty.

**Solution:**
Provide a valid connection string:
```yaml
- task: SqlPackagePublisher@0
  inputs:
    targetMethod: 'connectionString'
    connectionString: 'Server=myserver;Database=MyDB;User Id=sa;Password=$(SqlPassword)'
```

### "SQL Server authentication requires username and password"

**Cause:** Using `authenticationType: 'sqlServerAuthentication'` without credentials.

**Solution:**
Provide username and password:
```yaml
- task: SqlPackagePublisher@0
  inputs:
    authenticationType: 'sqlServerAuthentication'
    sqlUsername: 'sqladmin'
    sqlPassword: '$(SqlPassword)'
```

### "SqlPackage exited with code 1"

**Cause:** SqlPackage deployment failed (various reasons).

**Solutions:**
1. Enable debug mode to see detailed SqlPackage output:
   ```yaml
   variables:
     System.Debug: true
   ```
2. Check for common deployment issues:
   - Invalid credentials
   - Network connectivity
   - Insufficient permissions
   - Database locked or in use
   - Schema conflicts or data loss
3. Review SqlPackage error messages in the log

### "Login failed for user"

**Cause:** Authentication failed.

**Solutions:**
1. Verify credentials are correct
2. Check username format:
   - SQL Auth: `username` or `username@servername`
   - Windows Auth: `DOMAIN\username`
3. Ensure user has appropriate permissions
4. Test connection with SQL Server Management Studio
5. Check if user exists and is enabled

### "Cannot open server"

**Cause:** Network connectivity or firewall issue.

**Solutions:**
1. Verify server name is correct
2. Check firewall rules allow agent IP
3. For Azure SQL:
   - Add agent IP to firewall rules
   - Or enable "Allow Azure services" option
4. Test connectivity:
   ```yaml
   - script: |
       Test-NetConnection -ComputerName myserver.database.windows.net -Port 1433
     displayName: 'Test Database Connectivity'
   ```

## Debugging

### Enable Verbose Logging

**Pipeline level:**
```yaml
variables:
  System.Debug: true

steps:
- task: SqlPackagePublisher@0
```

**What you'll see:**
- Input values (with password redacted)
- SqlPackage availability check
- Connection string construction (with password redacted)
- Full SqlPackage command
- SqlPackage output
- Error details

### Verify SqlPackage Installation

After SqlPackage Installer runs:
```yaml
- script: |
    sqlpackage /version
    which sqlpackage  # Linux/macOS
    where sqlpackage  # Windows
  displayName: 'Verify SqlPackage'
```

### Test Connection String

Create a test script to validate connection:
```yaml
- task: PowerShell@2
  inputs:
    targetType: 'inline'
    script: |
      $connectionString = "Server=$(ServerName);Database=master;User Id=$(SqlUsername);Password=$(SqlPassword)"
      try {
        $connection = New-Object System.Data.SqlClient.SqlConnection($connectionString)
        $connection.Open()
        Write-Host "Connection successful!"
        $connection.Close()
      } catch {
        Write-Error "Connection failed: $_"
        exit 1
      }
  displayName: 'Test Database Connection'
```

### Validate DACPAC

Check DACPAC is valid before deployment:
```yaml
- script: |
    sqlpackage /Action:DeployReport \
      /SourceFile:$(Build.SourcesDirectory)/Database.dacpac \
      /TargetServerName:$(ServerName) \
      /TargetDatabaseName:$(DatabaseName) \
      /OutputPath:$(Build.ArtifactStagingDirectory)/deploy-report.xml
  displayName: 'Generate Deployment Report'

- task: PublishBuildArtifacts@1
  inputs:
    PathtoPublish: '$(Build.ArtifactStagingDirectory)/deploy-report.xml'
    ArtifactName: 'deployment-report'
```

## Known Limitations

### Authentication Methods
- Managed Identity not yet supported (planned)
- Service Principal authentication not yet supported (planned)
- Certificate-based authentication not supported

### Platform Support
- Requires SqlPackage to be pre-installed or installed via SqlPackage Installer
- No built-in SqlPackage download capability
- Depends on PATH environment variable

### Connection String
- TrustServerCertificate=True is automatically added
- May cause issues with strict SSL certificate validation
- Remove from connection string if needed

### Publish Profile
- Only XML format supported
- File must exist or will be skipped silently
- No validation of profile content

## Performance Optimization

### Large Databases
For large databases, consider:
1. Using publish profiles to control deployment options
2. Disabling unnecessary validations:
   ```yaml
   additionalArguments: |
     /p:VerifyDeployment=false
   ```
3. Increasing timeout if needed

### Multiple Deployments
For multiple database deployments:
1. Install SqlPackage once at the start
2. Reuse in all deployment tasks
3. Consider parallel deployments if databases are independent

## Security Best Practices

### Credentials Management
1. **Never** hardcode passwords in YAML
2. Always use Azure DevOps secret variables
3. Store credentials in variable groups
4. Rotate credentials regularly

### Connection Strings
1. Use Azure Key Vault for secrets when possible
2. Prefer Azure AD authentication over SQL auth
3. Use service accounts with minimal permissions
4. Enable SSL/TLS for production deployments

### Audit Trail
Enable logging and auditing:
```yaml
- task: SqlPackagePublisher@0
  inputs:
    additionalArguments: |
      /p:CreateNewDatabase=false
      /p:RegisterDataTierApplication=true
```

## Getting Help

### Debug Checklist

1. ✓ Enable `System.Debug: true`
2. ✓ Verify SqlPackage is installed
3. ✓ Check DACPAC file exists
4. ✓ Validate credentials
5. ✓ Test network connectivity
6. ✓ Review SqlPackage error messages
7. ✓ Check database server logs

### Log Analysis

**Look for these messages:**

**Success indicators:**
```
SqlPackage is available at: [path]
Building SqlPackage arguments...
Executing SqlPackage publish...
Database deployment completed successfully
```

**Failure indicators:**
```
DACPAC file not found at path
SqlPackage not found in PATH
Server name and database name are required
Login failed for user
SqlPackage exited with code 1
```

### Common SqlPackage Exit Codes

| Code | Meaning | Action |
|------|---------|--------|
| 0 | Success | Deployment completed |
| 1 | Error | Check SqlPackage output for details |
| 2 | Warning treated as error | Review warnings, adjust settings |

### Testing Locally

Test the task logic locally:
```powershell
# Set environment variables
$env:INPUT_DACPACFILE = "C:\path\to\Database.dacpac"
$env:INPUT_TARGETMETHOD = "server"
$env:INPUT_SERVERNAME = "localhost"
$env:INPUT_DATABASENAME = "TestDB"
$env:INPUT_AUTHENTICATIONTYPE = "windowsAuthentication"

# Run task
node index.js
```

## Reporting Issues

Include in your issue report:
1. Task version (check vss-extension.json)
2. Agent OS and version
3. Full logs with `System.Debug: true`
4. DACPAC file details (size, source)
5. Target database information (version, edition)
6. Authentication method used
7. Error messages and stack traces
8. Expected vs actual behavior

### Minimal Reproduction

Provide a minimal YAML that reproduces the issue:
```yaml
trigger: none

pool:
  vmImage: 'windows-latest'

steps:
- task: SqlPackageInstaller@1
  inputs:
    versionSpec: 'latest'

- task: SqlPackagePublisher@0
  inputs:
    dacpacFile: '$(Build.SourcesDirectory)/test.dacpac'
    serverName: 'testserver'
    databaseName: 'testdb'
    authenticationType: 'sqlServerAuthentication'
    sqlUsername: 'testuser'
    sqlPassword: '$(TestPassword)'
```

## Additional Resources

- [SqlPackage Documentation](https://docs.microsoft.com/sql/tools/sqlpackage)
- [Azure SQL Documentation](https://docs.microsoft.com/azure/azure-sql/)
- [DACPAC Best Practices](https://docs.microsoft.com/sql/relational-databases/data-tier-applications/data-tier-applications)
