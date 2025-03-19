@echo off
REM use-npm-server.cmd - Simple batch script to serve the website with npm

echo ==== Neo N3 MCP Website Local Server (npm) ====
echo Serving website files from: %CD%\website

REM Check if website directory exists
if not exist website (
  echo Error: website directory not found
  echo Please run this script from the root of your project where the website directory is located
  pause
  exit /b 1
)

REM Check if npm is available
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo Error: npm is not installed or not in your PATH
  echo Please install Node.js from https://nodejs.org/
  pause
  exit /b 1
)

REM Install http-server if not already installed
echo Checking if http-server is installed...
call npm list -g http-server >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo Installing http-server globally...
  call npm install -g http-server
)

REM Rebuild the website using Node.js script
echo Rebuilding website files...
if exist rebuild-website.js (
  node rebuild-website.js
) else (
  echo Website rebuild script not found, creating basic directories...
  REM Ensure all directories exist
  if not exist website\img mkdir website\img
  if not exist website\css mkdir website\css
  if not exist website\js mkdir website\js
)

REM Open browser
echo Opening http://localhost:8000 in your default browser...
start http://localhost:8000

REM Start the server
echo Starting npm http-server on port 8000...
echo Press Ctrl+C to stop the server

cd website
npx http-server -p 8000 --cors

echo Server stopped
pause 