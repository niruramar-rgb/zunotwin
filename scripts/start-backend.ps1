Write-Host "Starting ZUNO TWIN Node.js Backend on port 5000..." -ForegroundColor Cyan
Set-Location -Path "$PSScriptRoot\..\backend"
node src\server.js
