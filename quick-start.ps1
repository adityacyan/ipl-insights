# IPL AI Assistant - Quick Start Script
# This script starts the server (assumes frontend is already built)

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "IPL AI Assistant - Quick Start" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Check if Gemini API key is configured
$envContent = Get-Content "server\.env" -Raw
if ($envContent -match "GEMINI_API_KEY=your_gemini_api_key_here") {
    Write-Host "WARNING: Gemini API key not configured!" -ForegroundColor Red
    Write-Host "The AI features will not work without a valid API key." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To fix this:" -ForegroundColor Yellow
    Write-Host "1. Get an API key from: https://aistudio.google.com/app/apikey" -ForegroundColor White
    Write-Host "2. Edit server\.env and replace 'your_gemini_api_key_here' with your key" -ForegroundColor White
    Write-Host ""
}

# Check if frontend is built
if (-not (Test-Path "server\public\index.html")) {
    Write-Host "ERROR: Frontend not built!" -ForegroundColor Red
    Write-Host "Please run the deployment script first:" -ForegroundColor Yellow
    Write-Host "  .\deploy.ps1" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host "Starting server..." -ForegroundColor Yellow
Write-Host "Server will be available at: http://localhost:8080" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Gray
Write-Host ""

# Activate conda environment and start server
conda activate adobehackathon
python server\app.py
