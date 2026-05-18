# IPL AI Assistant - Deployment Script for Windows PowerShell
# This script builds the frontend and deploys it to the server

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "IPL AI Assistant - Deployment Script" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Check if Gemini API key is configured
Write-Host "Checking configuration..." -ForegroundColor Yellow
$envContent = Get-Content "server\.env" -Raw
if ($envContent -match "GEMINI_API_KEY=your_gemini_api_key_here") {
    Write-Host "WARNING: Gemini API key not configured!" -ForegroundColor Red
    Write-Host "Please update server\.env with your actual API key" -ForegroundColor Red
    Write-Host "Get one from: https://aistudio.google.com/app/apikey" -ForegroundColor Yellow
    Write-Host ""
    $continue = Read-Host "Continue anyway? (y/n)"
    if ($continue -ne "y") {
        exit 1
    }
}

# Step 1: Build frontend
Write-Host ""
Write-Host "Step 1: Building frontend..." -ForegroundColor Yellow
Set-Location client
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Frontend build failed!" -ForegroundColor Red
    Set-Location ..
    exit 1
}
Set-Location ..
Write-Host "Frontend build completed!" -ForegroundColor Green

# Step 2: Copy build to server
Write-Host ""
Write-Host "Step 2: Deploying to server..." -ForegroundColor Yellow

# Create server/public if it doesn't exist
if (-not (Test-Path "server\public")) {
    New-Item -ItemType Directory -Path "server\public" | Out-Null
}

# Copy files
Copy-Item -Path "client\dist\*" -Destination "server\public\" -Recurse -Force
Write-Host "Deployment completed!" -ForegroundColor Green

# Step 3: Test configuration
Write-Host ""
Write-Host "Step 3: Testing configuration..." -ForegroundColor Yellow
conda activate adobehackathon
python test_fixes.py

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "To start the server, run:" -ForegroundColor Yellow
Write-Host "  conda activate adobehackathon" -ForegroundColor White
Write-Host "  python server\app.py" -ForegroundColor White
Write-Host ""
Write-Host "Then open: http://localhost:8080" -ForegroundColor Cyan
Write-Host ""
