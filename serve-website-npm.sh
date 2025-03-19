#!/bin/bash
# serve-website-npm.sh - Serve the Neo N3 MCP website locally using npm

# Main execution
echo -e "\033[0;32m==== Neo N3 MCP Website Local Server (npm) ====\033[0m"
echo "Serving website files from: $(pwd)/website"
echo "Press Ctrl+C to stop the server"

# Check if website directory exists
if [ ! -d "website" ]; then
  echo -e "\033[0;31mError: website directory not found\033[0m"
  echo "Please run this script from the root of your project where the website directory is located"
  exit 1
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
  echo -e "\033[0;31mError: npm is not installed or not in your PATH\033[0m"
  echo "Please install Node.js from https://nodejs.org/"
  exit 1
fi

# Install http-server if not already installed
echo -e "\033[0;36mChecking if http-server is installed...\033[0m"
if ! npm list -g http-server &> /dev/null; then
  echo -e "\033[0;33mInstalling http-server globally...\033[0m"
  npm install -g http-server
fi

# Rebuild the website using Node.js script
echo -e "\033[0;36mRebuilding website files...\033[0m"
if [ -f "rebuild-website.js" ]; then
  node rebuild-website.js
else
  echo -e "\033[0;33mWebsite rebuild script not found, creating basic directories...\033[0m"
  # Ensure all directories exist
  mkdir -p website/img website/css website/js
fi

# Open the browser (platform-specific)
url="http://localhost:8000"
echo -e "\033[0;36mOpening $url in your default browser...\033[0m"

case "$(uname -s)" in
  Darwin*)    # macOS
    open "$url" &
    ;;
  Linux*)     # Linux
    if command -v xdg-open &> /dev/null; then
      xdg-open "$url" &
    else
      echo "Please open your browser and go to $url"
    fi
    ;;
  CYGWIN*|MINGW*|MSYS*)  # Windows
    start "$url" &
    ;;
  *)
    echo "Please open your browser and go to $url"
    ;;
esac

# Start the server
echo -e "\033[0;32mStarting npm http-server on port 8000...\033[0m"
cd website
npx http-server -p 8000 --cors 