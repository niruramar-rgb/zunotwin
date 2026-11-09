Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "         STARTING COMPLETE ZUNO TWIN PLATFORM             " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Start Python AI Microservice in background job
Write-Host "[1/3] Starting Python AI Microservice (Port 8000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-File", "$PSScriptRoot\start-ai.ps1"

Start-Sleep -Seconds 2

# 2. Start Node.js Backend & Serial Bridge in background job
Write-Host "[2/3] Starting Node.js Backend & Hardware Bridge (Port 5000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-File", "$PSScriptRoot\start-backend.ps1"

Start-Sleep -Seconds 2

# 3. Start React 3D Digital Twin Frontend in background job
Write-Host "[3/3] Starting React 3D Digital Twin Frontend (Port 5173)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-File", "$PSScriptRoot\start-frontend.ps1"

Write-Host "`nAll services successfully launched!" -ForegroundColor Green
Write-Host "Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "Backend:  http://localhost:5000" -ForegroundColor White
Write-Host "AI Micro: http://localhost:8000" -ForegroundColor White
