write-host "=== NPM Clean ===" -ForegroundColor Yellow
npm run clean

write-host "=== Git Clean ===" -ForegroundColor Yellow
git clean -ffxd

write-host "=== NPM Install ===" -ForegroundColor Yellow
npm install

write-host "=== Lint ===" -ForegroundColor Yellow
npm run lint

write-host "=== Test ===" -ForegroundColor Yellow
npm run test

write-host "=== Build ===" -ForegroundColor Yellow
npm run build

write-host "=== Package ===" -ForegroundColor Yellow
npm run package