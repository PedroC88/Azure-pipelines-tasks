# PowerShell script to prepare minimal node_modules for packaging
Write-Host "Preparing minimal node_modules for packaging..."

# Remove existing minimal if it exists
if (Test-Path "node_modules_minimal") {
    Remove-Item "node_modules_minimal" -Recurse -Force
}

# Backup full node_modules
if (Test-Path "node_modules") {
    if (Test-Path "node_modules_full") {
        Remove-Item "node_modules_full" -Recurse -Force
    }
    Move-Item "node_modules" "node_modules_full"
}

# Install only production dependencies
Write-Host "Installing production dependencies..."
npm ci --omit=dev

# Create fs.realpath polyfill module
Write-Host "Creating fs.realpath polyfill..."
if (!(Test-Path "node_modules\fs.realpath")) {
    New-Item -ItemType Directory -Path "node_modules\fs.realpath" -Force | Out-Null
}
Copy-Item "fs.realpath.js" "node_modules\fs.realpath\index.js"

# Create package.json for the polyfill module
@{
    name = "fs.realpath"
    version = "1.0.0"
    main = "index.js"
} | ConvertTo-Json | Out-File "node_modules\fs.realpath\package.json" -Encoding UTF8

# Rename to minimal
Move-Item "node_modules" "node_modules_minimal"

# Restore full node_modules for development
Move-Item "node_modules_full" "node_modules"

# For packaging, swap them
Move-Item "node_modules" "node_modules_temp"
Move-Item "node_modules_minimal" "node_modules"

# Also copy the minimal node_modules to SqlCmdInstaller directory
Write-Host "Copying minimal node_modules to SqlCmdInstaller directory..."
if (Test-Path "SqlCmdInstaller/node_modules") {
    Remove-Item "SqlCmdInstaller/node_modules" -Recurse -Force
}
Copy-Item "node_modules" "SqlCmdInstaller/node_modules" -Recurse -Force

# Copy the compiled task files to SqlCmdInstaller directory
Write-Host "Copying compiled task files to SqlCmdInstaller directory..."
Copy-Item "index.js" "SqlCmdInstaller/index.js" -Force
if (Test-Path "index.js.map") {
    Copy-Item "index.js.map" "SqlCmdInstaller/index.js.map" -Force
}
Copy-Item "task.json" "SqlCmdInstaller/task.json" -Force
Copy-Item "icon.png" "SqlCmdInstaller/icon.png" -Force

Write-Host "Minimal node_modules prepared successfully."