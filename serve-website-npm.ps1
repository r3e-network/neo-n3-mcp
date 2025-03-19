# serve-website-npm.ps1 - Serve the Neo N3 MCP website locally using npm
# Run this script with PowerShell

# Main execution
Write-Host "==== Neo N3 MCP Website Local Server (npm) ====" -ForegroundColor Green
Write-Host "Serving website files from: $(Get-Location)\website"
Write-Host "Press Ctrl+C to stop the server"

# Check if website directory exists
if (-not (Test-Path -Path "website" -PathType Container)) {
    Write-Host "Error: website directory not found" -ForegroundColor Red
    Write-Host "Please run this script from the root of your project where the website directory is located"
    exit
}

# Check if npm is available
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "Error: npm is not installed or not in your PATH" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/"
    exit
}

# Install http-server if not already installed
Write-Host "Checking if http-server is installed..." -ForegroundColor Cyan
$httpServerInstalled = npm list -g http-server 2>$null
if (-not $httpServerInstalled) {
    Write-Host "Installing http-server globally..." -ForegroundColor Yellow
    npm install -g http-server
}

# Rebuild the website using Node.js script
Write-Host "Rebuilding website files..." -ForegroundColor Cyan
if (Test-Path -Path "rebuild-website.js" -PathType Leaf) {
    node rebuild-website.js
}
else {
    Write-Host "Website rebuild script not found, creating basic directories..." -ForegroundColor Yellow
    # Ensure all directories exist
    if (-not (Test-Path -Path "website\img" -PathType Container)) {
        New-Item -Path "website\img" -ItemType Directory -Force | Out-Null
    }
    if (-not (Test-Path -Path "website\css" -PathType Container)) {
        New-Item -Path "website\css" -ItemType Directory -Force | Out-Null
    }
    if (-not (Test-Path -Path "website\js" -PathType Container)) {
        New-Item -Path "website\js" -ItemType Directory -Force | Out-Null
    }
}

# Open browser in a separate process
$url = "http://localhost:8000"
Write-Host "Opening $url in your default browser..." -ForegroundColor Cyan
Start-Process $url

# Start the server
Write-Host "Starting npm http-server on port 8000..." -ForegroundColor Green
Set-Location -Path "website"
npx http-server -p 8000 --cors -o 