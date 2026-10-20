# SqlCmd Installer

Azure DevOps task that installs Microsoft's cross-platform `sqlcmd` command-line utility and adds it to the PATH for the current pipeline job. Releases are downloaded from the official [microsoft/go-sqlcmd](https://github.com/microsoft/go-sqlcmd/releases) project.

## Usage

```yaml
- task: SqlCmdInstaller@1
  inputs:
    versionSpec: latest

- script: sqlcmd --version
  displayName: Verify sqlcmd
```

To pin a release:

```yaml
- task: SqlCmdInstaller@1
  inputs:
    versionSpec: '1.10.0'
```

## Inputs

| Input | Required | Default | Description |
| --- | --- | --- | --- |
| `versionSpec` | Yes | `latest` | Latest stable release, a major/minor version (for example `1.10`), or an exact version. |
| `checkLatest` | No | `false` | Resolve the version spec against the latest release metadata instead of using an exact-version cache hit. |
| `installDirectory` | No | Tool cache | Optional directory where `sqlcmd` will be installed. |

## Platforms

- Windows x64 and arm64
- Linux x64 and arm64

The task makes sqlcmd available to later steps in the same job; it does not install it system-wide.

## Development

```bash
npm ci
npm run build
npm test
npm run lint
```

Package the Azure DevOps extension with `npm run package`.
