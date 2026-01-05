# Architecture

## Overview

SqlPackage Installer is an Azure DevOps task that downloads, caches, and configures SqlPackage tools in pipeline agents.

## Components

### 1. Task Definition (`task.json`)
- Defines inputs, outputs, and execution handlers
- Supports Node 10, 16, and 20 runtimes
- Version: 1.0.17

### 2. Main Implementation (`index.ts`)
Core functions:
- `getAvailableVersions()` - Fetches versions from GitHub
- `acquireSqlPackage()` - Downloads and caches tools
- `findSqlPackageExecutable()` - Locates executable after extraction
- `run()` - Main task entry point

### 3. Build System
- **prepare-minimal.ps1** - Creates minimal node_modules for packaging
- **restore-modules.ps1** - Restores full node_modules after packaging
- **fs.realpath polyfill** - Node.js 16+ compatibility fix

## Data Flow

```
User Input (versionSpec)
    ↓
Check Tool Cache
    ↓
[Cache Hit] → Add to PATH → Done
    ↓
[Cache Miss]
    ↓
Fetch Available Versions (GitHub API)
    ↓
Download SqlPackage ZIP
    ↓
Extract Package
    ↓
Find Executable
    ↓
Cache Tool (with semantic version conversion)
    ↓
Add to PATH → Done
```

## Key Design Decisions

### Multi-Node Support
Supports Node 10, 16, and 20 to avoid runtime warnings and ensure compatibility across agent versions.

### Semantic Versioning Conversion
SqlPackage uses 4-part versions (e.g., `170.2.70.1`). Azure Pipelines Tool Library requires 3-part semantic versions. The task converts versions before caching:
```
170.2.70.1 → 170.2.70
```

### Conditional Logging
- Essential messages: Always shown
- Debug messages: Only when `System.Debug=true`

### ZIP-First Extraction
Prioritizes ZIP extraction over 7z for Docker container compatibility.

## Platform Support

| Platform | Architecture | Executable |
|----------|-------------|------------|
| Windows | x64 | sqlpackage.exe |
| Linux | x64 | sqlpackage |
| macOS | x64 | sqlpackage |

## Dependencies

- `azure-pipelines-task-lib` (v3.4.0) - Task framework
- `azure-pipelines-tool-lib` (v1.3.2) - Tool caching
- `fs.realpath` polyfill - Node.js 16+ compatibility

## Error Handling

Graceful degradation:
- GitHub API failure → Fallback to default versions
- ZIP extraction failure → Retry with 7z
- Version not found → Clear error message
