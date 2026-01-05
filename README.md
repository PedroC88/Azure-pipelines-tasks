# Azure DevOps Pipelines Tasks
This project hosts custom extensions for Azure DevOps pipelines, and it includes the extensions below. Each task has a small README inside and complete documentation for each one is available under the /docs directory.

This project has its own [license](LICENSE) which grants free rights to use and distribute the software for non-commercial use.

## SqlPackage.Installer
This extension makes available a specific version of SqlPackage on a build server by saving it to the tools cache. The extension is only available for the pipelines and it's not installed system-wide (similar to tasks to get a specific version of .Net or NodeJs).

The extension supports agents for all platforms running Node 10, 16 and 20.