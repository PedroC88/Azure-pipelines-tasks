# GitHub Branch Protection Configuration

This document explains how to configure GitHub branch protection rules to ensure that PR builds must pass before merging.

## Overview

Both the Installer and Publisher workflows now trigger on:
- **Push events** to the `develop` branch (for automatic publishing)
- **Pull request events** (for PR validation)

The workflows use path filtering, so they only trigger when relevant files change:
- **Installer workflow** triggers when files in `src/Services/Task.SqlPackage.Installer/` change
- **Publisher workflow** triggers when files in `src/Services/Task.SqlPackage.Publisher/` change

## Required Status Checks

The workflows define the following status checks that should be required:
- `Build and Publish SqlPackage Installer / build` - for Installer changes
- `Build and Publish SqlPackage Publisher / build` - for Publisher changes

**Important:** Due to path filtering, only the relevant status checks will be required for each PR:
- A PR that modifies only Installer files will only require the Installer build check
- A PR that modifies only Publisher files will only require the Publisher build check
- A PR that modifies both will require both checks
- A PR that modifies neither will require no checks

## Configuration Steps

### 1. Navigate to Branch Protection Settings

1. Go to your GitHub repository
2. Click **Settings** (requires admin access)
3. Click **Branches** in the left sidebar
4. Under "Branch protection rules", click **Add rule** (or edit an existing rule for your main branch)

### 2. Configure Branch Name Pattern

- Enter the branch name pattern you want to protect (e.g., `develop`, `main`, or `master`)

### 3. Enable Required Status Checks

1. Check **Require status checks to pass before merging**
2. Check **Require branches to be up to date before merging** (recommended)
3. In the search box under "Status checks that are required", search for and add:
   - `Build and Publish SqlPackage Installer / build`
   - `Build and Publish SqlPackage Publisher / build`

### 4. Additional Recommended Settings

- ✅ **Require a pull request before merging** - Forces all changes to go through PR review
- ✅ **Require approvals** - Set to 1 or more reviewers
- ✅ **Dismiss stale pull request approvals when new commits are pushed** - Ensures re-review after changes
- ✅ **Do not allow bypassing the above settings** - Applies rules to administrators too

### 5. Save Changes

Click **Create** or **Save changes** at the bottom of the page.

## How It Works

### Scenario 1: PR with Installer Changes

```
PR: Feature branch → develop
Files changed: src/Services/Task.SqlPackage.Installer/index.ts

Status checks required:
✅ Build and Publish SqlPackage Installer / build

Status checks NOT required (no changes to Publisher):
⚪ Build and Publish SqlPackage Publisher / build
```

### Scenario 2: PR with Publisher Changes

```
PR: Feature branch → develop
Files changed: src/Services/Task.SqlPackage.Publisher/index.ts

Status checks required:
✅ Build and Publish SqlPackage Publisher / build

Status checks NOT required (no changes to Installer):
⚪ Build and Publish SqlPackage Installer / build
```

### Scenario 3: PR with Both Extensions Changed

```
PR: Feature branch → develop
Files changed:
  - src/Services/Task.SqlPackage.Installer/index.ts
  - src/Services/Task.SqlPackage.Publisher/index.ts

Status checks required:
✅ Build and Publish SqlPackage Installer / build
✅ Build and Publish SqlPackage Publisher / build
```

### Scenario 4: PR with No Extension Changes

```
PR: Feature branch → develop
Files changed: README.md

Status checks NOT required:
⚪ Build and Publish SqlPackage Installer / build
⚪ Build and Publish SqlPackage Publisher / build

Result: PR can be merged without waiting for builds
```

## Troubleshooting

### Status Checks Not Appearing

If the status checks don't appear in the search box:
1. Create a test PR that triggers both workflows
2. Wait for the workflows to run at least once
3. The status check names should then be available in the branch protection settings

### Wrong Status Check Names

The status check name format is: `<workflow name> / <job name>`

Current workflow names:
- `Build and Publish SqlPackage Installer`
- `Build and Publish SqlPackage Publisher`

Job name: `build`

If you rename the workflows or job names, update the status check requirements accordingly.

### Build Always Required Even Without Changes

This indicates the path filtering is not working correctly. Verify:
1. The workflow files have `paths:` configured under both `push:` and `pull_request:` triggers
2. The paths match the directory structure exactly
3. No typos in the path patterns

## Workflow Files Reference

### Installer Workflow
`.github/workflows/publish-installer.yml`
```yaml
on:
  push:
    branches: [develop]
    paths:
      - 'src/Services/Task.SqlPackage.Installer/**'
      - '.github/workflows/publish-installer.yml'
  pull_request:
    paths:
      - 'src/Services/Task.SqlPackage.Installer/**'
      - '.github/workflows/publish-installer.yml'
```

### Publisher Workflow
`.github/workflows/publish-publisher.yml`
```yaml
on:
  push:
    branches: [develop]
    paths:
      - 'src/Services/Task.SqlPackage.Publisher/**'
      - '.github/workflows/publish-publisher.yml'
  pull_request:
    paths:
      - 'src/Services/Task.SqlPackage.Publisher/**'
      - '.github/workflows/publish-publisher.yml'
```

## Testing

To test the configuration:

1. Create a test branch: `git checkout -b test/pr-checks`
2. Make a small change to one extension (e.g., update a comment in `src/Services/Task.SqlPackage.Installer/index.ts`)
3. Commit and push: `git commit -am "test: PR checks" && git push -u origin test/pr-checks`
4. Create a PR from this branch to `develop`
5. Verify that only the Installer workflow runs
6. Verify that the PR shows the required status check
7. Wait for the build to complete and verify the PR can be merged

## Additional Notes

- The `publish` job in both workflows will **not** run on PRs (it only runs on pushes to develop when the version changes)
- Only the `build` job (which includes linting, tests, and coverage) runs on PRs
- This ensures PRs are validated without publishing to the marketplace
- After merging to `develop`, if the version has changed, the extension will be automatically published
