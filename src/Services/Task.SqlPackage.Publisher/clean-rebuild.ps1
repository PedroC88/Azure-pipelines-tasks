Write-Host "=== NPM Clean ===" -ForegroundColor Cyan
npm run clean

Write-Host "`n=== Git Clean ===" -ForegroundColor Cyan
git clean -fdx -e node_modules -e .taskkey -e overview.md

Write-Host "`n=== NPM Install ===" -ForegroundColor Cyan
npm install

Write-Host "`n=== Lint ===" -ForegroundColor Cyan
npm run lint

Write-Host "`n=== Test ===" -ForegroundColor Cyan
npm run test

Write-Host "`n=== Build ===" -ForegroundColor Cyan
npm run build

Write-Host "`n=== Package ===" -ForegroundColor Cyan
npm run package

Write-Host "`nBuild completed successfully!" -ForegroundColor Green
