#!/bin/bash
# serve-website.sh - Serve the existing Neo N3 MCP website locally

# Function to detect the HTTP server available
detect_server() {
  if command -v python3 &> /dev/null; then
    echo "python3"
  elif command -v python &> /dev/null; then
    echo "python"
  elif command -v npx &> /dev/null; then
    echo "npx"
  else
    echo "none"
  fi
}

# Start a local server
start_server() {
  local server_type=$(detect_server)
  
  echo "Starting local server for existing website..."
  cd website
  
  case $server_type in
    "python3")
      echo "Using Python 3 HTTP server on port 8000"
      python3 -m http.server 8000
      ;;
    "python")
      echo "Using Python 2 HTTP server on port 8000"
      python -m SimpleHTTPServer 8000
      ;;
    "npx")
      echo "Using Node.js HTTP server on port 8000"
      npx http-server -p 8000 --silent
      ;;
    *)
      echo "No suitable HTTP server found. Please install Python or Node.js."
      echo "Then run one of these commands in the website directory:"
      echo "  python3 -m http.server 8000"
      echo "  python -m SimpleHTTPServer 8000"
      echo "  npx http-server -p 8000"
      exit 1
      ;;
  esac
}

# Open the browser (platform-specific)
open_browser() {
  local url="http://localhost:8000"
  echo "Opening $url in your default browser..."
  
  case "$(uname -s)" in
    Darwin*)    # macOS
      open "$url"
      ;;
    Linux*)     # Linux
      if command -v xdg-open &> /dev/null; then
        xdg-open "$url"
      else
        echo "Please open your browser and go to $url"
      fi
      ;;
    CYGWIN*|MINGW*|MSYS*)  # Windows
      start "$url"
      ;;
    *)
      echo "Please open your browser and go to $url"
      ;;
  esac
}

# Main execution
echo "==== Neo N3 MCP Website Local Server ===="
echo "Serving website files from: $(pwd)/website"
echo "Press Ctrl+C to stop the server"

# Check if website directory exists
if [ ! -d "website" ]; then
  echo "Error: website directory not found"
  echo "Please run this script from the root of your project where the website directory is located"
  exit 1
fi

# Open browser in background
open_browser &

# Start the server (this blocks until Ctrl+C)
start_server 