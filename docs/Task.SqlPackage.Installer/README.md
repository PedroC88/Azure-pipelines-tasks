# SqlPackage Installer Documentation

Complete documentation for the SqlPackage Installer Azure DevOps extension.

## Contents

### [Architecture](architecture.md)
Learn how the extension works:
- Component overview
- Data flow
- Design decisions
- Platform support
- Dependencies

### [Build Process](build-process.md)
How to build and package:
- Quick build commands
- Build steps explained
- Packaging details
- Version management
- Testing locally

### [Usage Examples](usage-examples.md)
Real-world pipeline examples:
- Basic usage
- Common scenarios
- CI/CD pipelines
- Multi-stage deployments
- Cross-platform usage

### [Troubleshooting](troubleshooting.md)
Fix common issues:
- Common errors and solutions
- Debugging techniques
- Known limitations
- Getting help

### [Version History](version-history.md)
Track changes over time:
- Release notes
- Bug fixes
- Breaking changes
- Upgrade guide
- Future roadmap

## Quick Links

**Getting Started:**
- [Main README](../README.md)
- [Installation Guide](build-process.md#quick-build)
- [Basic Usage](usage-examples.md#basic-usage)

**Development:**
- [Architecture Overview](architecture.md#overview)
- [Build Steps](build-process.md#build-steps-explained)
- [Testing](build-process.md#testing-locally)

**Support:**
- [Common Issues](troubleshooting.md#common-issues)
- [Debug Mode](troubleshooting.md#enable-verbose-logging)
- [Report Issues](troubleshooting.md#reporting-issues)

## Contributing

1. Read [Architecture](architecture.md) to understand the codebase
2. Follow [Build Process](build-process.md) for setup
3. Test thoroughly using [Troubleshooting](troubleshooting.md) techniques
4. Update documentation for any changes

## Support

Enable debug logging for detailed information:
```yaml
variables:
  System.Debug: true
```

See [Troubleshooting](troubleshooting.md) for more help.
