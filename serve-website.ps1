# serve-website.ps1 - Serve the existing Neo N3 MCP website locally on Windows
# Run this script with PowerShell

# Function to detect available HTTP servers
function Detect-Server {
    if (Get-Command python -ErrorAction SilentlyContinue) {
        return "python"
    }
    elseif (Get-Command py -ErrorAction SilentlyContinue) {
        return "py"
    }
    elseif (Get-Command npx -ErrorAction SilentlyContinue) {
        return "npx"
    }
    else {
        return "none"
    }
}

# Function to start a local server
function Start-WebServer {
    $serverType = Detect-Server
    
    Write-Host "Starting local server for existing website..."
    Set-Location -Path "website"
    
    switch ($serverType) {
        "python" {
            Write-Host "Using Python HTTP server on port 8000"
            python -m http.server 8000
            break
        }
        "py" {
            Write-Host "Using Python HTTP server on port 8000"
            py -m http.server 8000
            break
        }
        "npx" {
            Write-Host "Using Node.js HTTP server on port 8000"
            npx http-server -p 8000
            break
        }
        default {
            Write-Host "No suitable HTTP server found. Please install Python or Node.js."
            Write-Host "Then run one of these commands in the website directory:"
            Write-Host "  python -m http.server 8000"
            Write-Host "  npx http-server -p 8000"
            break
        }
    }
}

# Function to open the browser
function Open-Browser {
    $url = "http://localhost:8000"
    Write-Host "Opening $url in your default browser..."
    Start-Process $url
}

# Main execution
Write-Host "==== Neo N3 MCP Website Local Server ===="
Write-Host "Serving website files from: $(Get-Location)\website"
Write-Host "Press Ctrl+C to stop the server"

# Check if website directory exists
if (-not (Test-Path -Path "website" -PathType Container)) {
    Write-Host "Error: website directory not found" -ForegroundColor Red
    Write-Host "Please run this script from the root of your project where the website directory is located"
    exit
}

# Open browser in a separate process
Open-Browser

# Start the server
Start-WebServer 