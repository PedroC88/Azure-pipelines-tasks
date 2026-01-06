# Architecture

## Overview

SqlPackage Publisher is an Azure DevOps task that deploys DACPAC files to SQL Server databases using SqlPackage. It provides a flexible deployment interface with support for multiple authentication methods, connection modes, and deployment options.

## Components

### 1. Task Definition (`task.json`)
- Defines inputs, outputs, and execution handlers
- Supports Node 20 runtime
- Version: 0.0.1
- Input groups for organized UI experience

### 2. Main Implementation (`index.ts`)
Core workflow:
- **Input Validation** - Validates DACPAC file and required parameters
- **SqlPackage Check** - Verifies SqlPackage is available in PATH
- **Connection String Builder** - Constructs connection string based on authentication method
- **Argument Builder** - Assembles SqlPackage command arguments
- **Execution** - Runs SqlPackage with proper error handling
- **run()** - Main task entry point

### 3. Build System
- **prepare-minimal.ps1** - Creates minimal node_modules for packaging
- **restore-modules.ps1** - Restores full node_modules after packaging
- **clean-rebuild.ps1** - Complete clean build process

## Data Flow

```
User Inputs
    ↓
Validate DACPAC File Exists
    ↓
Check SqlPackage Availability
    ↓
Determine Connection Method
    ├─→ Server Details → Build Connection String
    │   ├─→ Windows Authentication
    │   ├─→ SQL Server Authentication
    │   └─→ Azure Active Directory
    └─→ Connection String → Use Directly
    ↓
Build SqlPackage Arguments
    ├─→ Action: Publish
    ├─→ SourceFile: DACPAC path
    ├─→ TargetConnectionString
    ├─→ Profile (optional)
    └─→ Additional Arguments (optional)
    ↓
Execute SqlPackage
    ↓
[Success] → Set Result Succeeded
[Failure] → Set Result Failed
```

## Key Design Decisions

### Authentication Flexibility
Supports three authentication methods:
1. **Windows Authentication** - Integrated Security for domain accounts
2. **SQL Server Authentication** - Username/password authentication
3. **Azure Active Directory** - Cloud-native authentication for Azure SQL

### Dual Connection Modes
- **Server Details** - Specify server, database, and authentication separately
- **Connection String** - Provide complete connection string directly

### SqlPackage Dependency
Requires SqlPackage to be pre-installed or available in PATH. Works seamlessly with SqlPackage Installer task.

### Profile Support
Optional publish profile (`.publish.xml`) for advanced deployment configurations without cluttering task inputs.

### Additional Arguments
Multiline input for additional SqlPackage parameters, parsed and filtered for empty lines.

## Input Groups

Organized for clarity in Azure DevOps UI:

| Group | Inputs | Purpose |
|-------|--------|---------|
| Source | dacpacFile | DACPAC file to deploy |
| Target | targetMethod, serverName, databaseName, connectionString | Connection configuration |
| Authentication | authenticationType, sqlUsername, sqlPassword | Credentials |
| Options | publishProfile, additionalArguments | Optional deployment settings |

## Platform Support

| Platform | Support | SqlPackage Requirement |
|----------|---------|----------------------|
| Windows | ✓ | Must be in PATH |
| Linux | ✓ | Must be in PATH |
| macOS | ✓ | Must be in PATH |

**Note:** Use SqlPackage Installer task to ensure SqlPackage is available on all platforms.

## Dependencies

- `azure-pipelines-task-lib` (v5.2.4) - Task framework
- `fs` (Node.js built-in) - File system operations

## Error Handling

Comprehensive validation and error messages:
- **Missing DACPAC** - Clear error with file path
- **DACPAC not found** - File existence check before deployment
- **SqlPackage not available** - Explicit check with helpful message
- **Missing credentials** - Validation for SQL authentication
- **Empty connection string** - Validation for connection string mode
- **Missing server/database** - Validation for server mode
- **Deployment failure** - SqlPackage exit code captured and reported

## Security Considerations

### Credential Handling
- Passwords passed as command arguments (SqlPackage requirement)
- Use Azure DevOps secret variables for credentials
- Connection strings can contain sensitive data - secure appropriately

### Recommendations
1. Store credentials in Azure DevOps variable groups
2. Mark sensitive variables as secrets
3. Use Azure AD authentication when possible
4. Avoid logging connection strings in verbose mode

## Connection String Construction

### Windows Authentication
```
Server={serverName};Database={databaseName};Integrated Security=True;TrustServerCertificate=True
```

### SQL Server Authentication
```
Server={serverName};Database={databaseName};User Id={username};Password={password};TrustServerCertificate=True
```

### Azure Active Directory
```
Server={serverName};Database={databaseName};Authentication=Active Directory Integrated;TrustServerCertificate=True
```

**TrustServerCertificate** is added for compatibility with self-signed certificates and development environments. Remove for production if proper certificates are configured.

## Extensibility

The modular design allows for future enhancements:
- Additional authentication methods (Managed Identity, Service Principal)
- Pre/post deployment scripts
- Drift detection
- Rollback support
- Multiple DACPAC deployments
