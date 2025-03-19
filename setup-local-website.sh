#!/bin/bash
# setup-local-website.sh - Set up the Neo N3 MCP website locally

# Create directory structure if it doesn't exist
mkdir -p website/{css,js,img}

# Check if required files exist
if [ ! -f "website/index.html" ] || [ ! -f "website/css/styles.css" ] || [ ! -f "website/js/main.js" ]; then
  echo "Missing required files. Checking if we need to create them..."
  
  # Create CSS directory and file if needed
  if [ ! -f "website/css/styles.css" ]; then
    echo "Creating styles.css..."
    mkdir -p website/css
    # Copy existing CSS or create a placeholder
    cat > website/css/styles.css << 'EOF'
/* Neo N3 MCP Server Website Styles can be copied from existing file */
:root {
  --primary-color: #00e599;
  --primary-light: rgba(0, 229, 153, 0.1);
  --primary-gradient: linear-gradient(135deg, #00e599 0%, #00b8a9 100%);
  /* Other styles would be here */
}
EOF
  fi
  
  # Create JS directory and file if needed
  if [ ! -f "website/js/main.js" ]; then
    echo "Creating main.js..."
    mkdir -p website/js
    cat > website/js/main.js << 'EOF'
/**
 * Neo N3 MCP Server Website JavaScript
 */
document.addEventListener('DOMContentLoaded', function() {
  // Script setup would be here
});
EOF
  fi
  
  # Create index.html if needed
  if [ ! -f "website/index.html" ]; then
    echo "Creating index.html..."
    cat > website/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Neo N3 MCP Server | R3E Network</title>
    <link rel="stylesheet" href="css/styles.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
</head>
<body>
    <header>
        <div class="container">
            <div class="logo">
                <h1>Neo N3 MCP Server</h1>
                <span class="powered-by">Powered by R3E Network</span>
            </div>
        </div>
    </header>
    <script src="js/main.js"></script>
</body>
</html>
EOF
  fi
fi

# Create SVG icons if they don't exist
for icon in icon-blockchain icon-contract icon-network icon-protocol logo-placeholder; do
  if [ ! -f "website/img/${icon}.svg" ]; then
    echo "Creating placeholder for ${icon}.svg..."
    touch "website/img/${icon}.svg"
  fi
done

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
  
  echo "Starting local server..."
  cd website
  
  case $server_type in
    "python3")
      python3 -m http.server 8000
      ;;
    "python")
      python -m SimpleHTTPServer 8000
      ;;
    "npx")
      npx http-server -p 8000
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
echo "==== Neo N3 MCP Website Local Setup ===="
echo "Website files are in: $(pwd)/website"

# Open browser in background
open_browser &

# Start the server (this blocks until Ctrl+C)
start_server 