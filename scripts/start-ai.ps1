Write-Host "Starting ZUNO TWIN Python AI Microservice on port 8000..." -ForegroundColor Cyan
Set-Location -Path "$PSScriptRoot\..\models"
python -m uvicorn ai_service:app --host 127.0.0.1 --port 8000
