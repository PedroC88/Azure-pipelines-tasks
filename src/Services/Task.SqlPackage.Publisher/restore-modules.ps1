Write-Host "Restoring full node_modules..."

# Remove minimal modules
if (Test-Path "node_modules_minimal") {
    Remove-Item "node_modules_minimal" -Recurse -Force
}

# Restore full modules if needed
if (-not (Test-Path "node_modules")) {
    npm install
}

Write-Host "Full node_modules restored successfully."
