# SqlCmd Installer

Install Microsoft's cross-platform `sqlcmd` command-line utility in an Azure Pipelines job. The task downloads official releases from [microsoft/go-sqlcmd](https://github.com/microsoft/go-sqlcmd/releases), uses the agent tools cache, and adds the executable to PATH for subsequent steps.

```yaml
- task: SqlCmdInstaller@1
  inputs:
    versionSpec: latest

- script: sqlcmd --version
  displayName: Verify sqlcmd
```

The task supports Windows and Linux x64/arm64 agents. It does not install sqlcmd system-wide.
