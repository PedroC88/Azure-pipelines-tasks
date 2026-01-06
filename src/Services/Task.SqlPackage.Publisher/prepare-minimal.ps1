Write-Host "Preparing minimal node_modules for packaging..."

# Clean previous builds
if (Test-Path "SqlPackagePublisher") {
    Remove-Item "SqlPackagePublisher" -Recurse -Force
}
if (Test-Path "node_modules_minimal") {
    Remove-Item "node_modules_minimal" -Recurse -Force
}
if (Test-Path "node_modules_temp") {
    Remove-Item "node_modules_temp" -Recurse -Force
}

# Create temp directory and copy package.json
Write-Host "Installing production dependencies..."
New-Item -ItemType Directory -Path "node_modules_temp" -Force | Out-Null
Copy-Item "package.json" "node_modules_temp\" -Force

# Install production dependencies only
Set-Location "node_modules_temp"
npm install --omit=dev
Set-Location ..

# Create fs.realpath polyfill
Write-Host "Creating fs.realpath polyfill..."
$realpathDir = "node_modules_temp\node_modules\fs.realpath"
if (-not (Test-Path $realpathDir)) {
    New-Item -ItemType Directory -Path $realpathDir -Force | Out-Null
}

$realpathIndexContent = @"
module.exports = require('fs').realpath;
module.exports.native = require('fs').realpath;
"@
Set-Content -Path "$realpathDir\index.js" -Value $realpathIndexContent

$realpathPackageContent = @"
{
  "name": "fs.realpath",
  "version": "1.0.0",
  "main": "index.js"
}
"@
Set-Content -Path "$realpathDir\package.json" -Value $realpathPackageContent

# Move to minimal folder
Move-Item "node_modules_temp\node_modules" "node_modules_minimal"
Remove-Item "node_modules_temp" -Recurse -Force

# Create SqlPackagePublisher directory
New-Item -ItemType Directory -Path "SqlPackagePublisher" -Force | Out-Null

# Copy minimal node_modules
Write-Host "Copying minimal node_modules to SqlPackagePublisher directory..."
Copy-Item "node_modules_minimal" "SqlPackagePublisher\node_modules" -Recurse

# Copy compiled task files
Write-Host "Copying compiled task files to SqlPackagePublisher directory..."
Copy-Item "index.js" "SqlPackagePublisher\" -Force
Copy-Item "task.json" "SqlPackagePublisher\" -Force
if (Test-Path "package.json") {
    Copy-Item "package.json" "SqlPackagePublisher\" -Force
}

# Copy overview and icon files for VSIX package
Write-Host "Copying overview and icon files..."
if (Test-Path "overview.md") {
    Copy-Item "overview.md" "." -Force
}
if (Test-Path "icon.png") {
    Copy-Item "icon.png" "." -Force
}

Write-Host "Minimal node_modules prepared successfully."
