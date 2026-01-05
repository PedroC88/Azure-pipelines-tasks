# PowerShell script to restore full node_modules after packaging
Write-Host "Restoring full node_modules..."

if (Test-Path "node_modules_temp") {
    if (Test-Path "node_modules") {
        Remove-Item "node_modules" -Recurse -Force
    }
    Move-Item "node_modules_temp" "node_modules"
    Write-Host "Full node_modules restored successfully."
} else {
    Write-Host "No backup found, skipping restore."
}