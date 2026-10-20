# Azure DevOps Pipelines Tasks
This project hosts custom extensions for Azure DevOps pipelines, and it includes the extensions below. Each task has a small README inside and complete documentation for each one is available under the /docs directory.

This project is licensed under the [MIT License](LICENSE).

## SqlPackage.Installer
This extension supports agents for all platforms running Node 10, 16 and 20, and makes available a specific version of SqlPackage on a build server by saving it to the tools cache. SqlPackage will only be available for the pipeline that requests it and it's not installed system-wide (similar to tasks to get a specific version of .Net or NodeJs). This is the intended behaviour to allow different pipelines to use different versions of SqlPackage as per development needs.

Installing this extension **DOES NOT** make SqlPackage available for the Microsoft SQL Deployment task because that task is hardcoded to search for the binaries on the Windows Registry, which requires system-wide changes outside of the scope (and conflicting with the purpose) of this task.

## SqlPackage.Publisher
This extension uses the SqlPackage binary available in the session to publish a DacPac from the console, the task has an UI and yaml parameters similar to Microsoft Sql Deployment task to make it easy to transition from that task to this one, however they don't work the same.

This task can be used on systems without SqlPackage by using the companion installer task. It can also be used on systems with SqlPackage pre-installed as long as the executable is available on the session context (ej.: the PATH variable on Windows systems).

The Publisher also supports running SQL script files or inline SQL through `sqlcmd`; install it first with [SqlCmd.Installer](src/Services/Task.SqlCmd.Installer/README.md). Existing DACPAC pipelines continue to use SqlPackage by default.

## SqlCmd.Installer
This task installs Microsoft's cross-platform `sqlcmd` utility from the official go-sqlcmd releases and adds it to PATH for later steps in the same pipeline job. It supports Windows and Linux x64 and arm64 agents.

```yaml
- task: SqlCmdInstaller@1
  inputs:
    versionSpec: 'latest'
```

Use `versionSpec` to select the latest stable release, a major/minor line (for example `1.10`), or an exact version. See [the SqlCmd Installer README](src/Services/Task.SqlCmd.Installer/README.md) for inputs and details.
