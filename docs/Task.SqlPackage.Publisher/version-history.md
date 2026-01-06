# Version History

## v0.0.1 (Initial Release)
**Date:** January 2026

### Features
- DACPAC deployment to SQL Server databases
- Multiple authentication methods:
  - Windows Authentication (Integrated Security)
  - SQL Server Authentication (username/password)
  - Azure Active Directory (Integrated)
- Dual connection modes:
  - Server details (server, database, authentication)
  - Direct connection string
- Optional publish profile support (`.publish.xml`)
- Additional SqlPackage arguments (multiline input)
- Cross-platform support (Windows, Linux, macOS)
- Comprehensive input validation
- Detailed error messages
- Integration with SqlPackage Installer task

### Technical Details
- Node.js 20 runtime
- TypeScript 5.7.2
- azure-pipelines-task-lib 5.2.4
- 22 comprehensive unit tests
- ESLint for code quality
- Jest for testing

### Known Limitations
- Requires SqlPackage to be pre-installed or installed via SqlPackage Installer
- Managed Identity authentication not yet supported
- Service Principal authentication not yet supported
- No built-in retry mechanism
- No drift detection
- No rollback support

---

## Upcoming Features

### v0.1.0 (Planned)
- Test coverage reporting
- Additional authentication methods
- Enhanced error messages with suggestions
- Performance optimizations

### v1.0.0 (Stable Release - Planned)
- Production-ready after thorough testing
- Full marketplace documentation
- Community feedback integration
- Performance benchmarks

---

## Roadmap

### Short Term (v0.x)
- [ ] Add test coverage badges
- [ ] Implement Managed Identity authentication
- [ ] Add Service Principal authentication
- [ ] Improve error messages with actionable suggestions
- [ ] Add drift detection option
- [ ] Support for multiple DACPAC deployments
- [ ] Pre/post deployment script hooks

### Medium Term (v1.x)
- [ ] Rollback capability
- [ ] Deployment validation
- [ ] Smoke tests after deployment
- [ ] Integration with Azure Key Vault
- [ ] Parallel deployment support
- [ ] Deployment reporting and metrics

### Long Term (v2.x)
- [ ] Blue-green deployment support
- [ ] Canary deployment patterns
- [ ] Database state comparison
- [ ] Automated backup before deployment
- [ ] Advanced retry mechanisms
- [ ] Integration with monitoring tools

---

## Breaking Changes

None. This is the initial release.

---

## Upgrade Path

As this is v0.0.1, there is no upgrade path yet. Future versions will maintain backward compatibility or provide clear migration guides.

---

## Compatibility

### Azure DevOps
- Azure DevOps Server 2019+
- Azure DevOps Services (cloud)

### SQL Server Versions
Compatible with SqlPackage-supported versions:
- SQL Server 2014+
- Azure SQL Database
- Azure SQL Managed Instance
- SQL Server on Linux

### Agent Requirements
- Node.js 20+ runtime
- SqlPackage installed (via SqlPackage Installer or pre-installed)
- Network connectivity to target database

### Operating Systems
- Windows Server 2016+
- Ubuntu 18.04+
- macOS 10.15+

---

## Migration from Other Tools

### From Microsoft SqlDacpacDeploymentOnMachineGroup

**Before:**
```yaml
- task: SqlDacpacDeploymentOnMachineGroup@0
  inputs:
    DacpacFile: '$(Build.SourcesDirectory)/Database.dacpac'
    TargetMethod: 'server'
    ServerName: 'myserver'
    DatabaseName: 'MyDatabase'
    AuthScheme: 'sqlServerAuthentication'
    SqlUsername: '$(SqlUser)'
    SqlPassword: '$(SqlPassword)'
```

**After:**
```yaml
- task: SqlPackageInstaller@1  # Required: Install SqlPackage first
  inputs:
    versionSpec: 'latest'

- task: SqlPackagePublisher@0
  inputs:
    dacpacFile: '$(Build.SourcesDirectory)/Database.dacpac'
    targetMethod: 'server'
    serverName: 'myserver'
    databaseName: 'MyDatabase'
    authenticationType: 'sqlServerAuthentication'
    sqlUsername: '$(SqlUser)'
    sqlPassword: '$(SqlPassword)'
```

**Key Differences:**
1. Requires SqlPackage Installer task
2. Different input names (camelCase vs PascalCase)
3. Different authentication type values
4. Works with PATH-based SqlPackage (better for shared agents)

### From Custom PowerShell/Bash Scripts

**Before:**
```yaml
- powershell: |
    sqlpackage /Action:Publish `
      /SourceFile:Database.dacpac `
      /TargetServerName:$(Server) `
      /TargetDatabaseName:$(Database) `
      /TargetUser:$(User) `
      /TargetPassword:$(Password)
```

**After:**
```yaml
- task: SqlPackageInstaller@1

- task: SqlPackagePublisher@0
  inputs:
    dacpacFile: 'Database.dacpac'
    serverName: '$(Server)'
    databaseName: '$(Database)'
    authenticationType: 'sqlServerAuthentication'
    sqlUsername: '$(User)'
    sqlPassword: '$(Password)'
```

**Benefits:**
1. Better input validation
2. Consistent error handling
3. Integration with Azure DevOps logging
4. No need to maintain custom scripts
5. Cross-platform support

---

## Development History

### Design Decisions

**Why multiple authentication methods?**
To support various deployment scenarios:
- On-premises with domain accounts (Windows Auth)
- SQL Server with mixed mode (SQL Auth)
- Azure SQL with managed identities (Azure AD)

**Why dual connection modes?**
Flexibility for different use cases:
- Server mode: Clean UI with separate inputs
- Connection string mode: Advanced scenarios with full control

**Why optional publish profile?**
- Keeps common settings in task inputs
- Complex settings in profile XML
- Reusable across environments

**Why require SqlPackage Installer?**
- Separation of concerns
- Flexibility in SqlPackage version
- Better compatibility with shared agents
- Smaller task package size

---

## Testing History

### Test Coverage
- **22 comprehensive tests** covering:
  - Input validation (3 tests)
  - Windows Authentication (1 test)
  - SQL Server Authentication (2 tests)
  - Azure AD Authentication (1 test)
  - Connection String mode (2 tests)
  - Publish Profile handling (2 tests)
  - Additional Arguments (3 tests)
  - Command Execution (3 tests)
  - Error Handling (3 tests)
  - Command Construction (2 tests)

### Test Results
- All 22 tests passing
- 100% of core functionality covered
- Comprehensive mocking of Azure Pipelines SDK
- Integration-style tests validating full workflows

---

## Release Process

### Manual Steps for v0.0.1
1. Update version in package.json, task.json, vss-extension.json
2. Run `npm run lint` and `npm test`
3. Run `npm run package`
4. Test VSIX in Azure DevOps organization
5. Upload to marketplace
6. Create GitHub release

### Automated Process (Future)
GitHub Actions workflow handles:
- Lint and test on every push
- Build VSIX artifact
- Publish to marketplace on version change
- Create GitHub release with notes

---

## Community

### Contributing
Contributions welcome! See repository for guidelines.

### Support
- GitHub Issues for bug reports
- Discussions for questions and ideas
- Pull requests for improvements

### License
UNLICENSED - Custom non-commercial license

---

## Changelog

All notable changes to this project will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

### [0.0.1] - 2026-01-06

#### Added
- Initial release of SqlPackage Publisher
- Windows, SQL Server, and Azure AD authentication
- Server and connection string modes
- Publish profile support
- Additional arguments support
- Comprehensive test suite
- Cross-platform support
- Complete documentation
