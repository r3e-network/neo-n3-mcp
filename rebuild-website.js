/**
 * rebuild-website.js
 * 
 * This script rebuilds the Neo N3 MCP website from source files.
 * It copies any needed files, processes templates, and ensures
 * that all required files are in place.
 */

const fs = require('fs');
const path = require('path');

// Base directories
const websiteDir = path.join(__dirname, 'website');
const srcDir = path.join(__dirname, 'src');
const docsDir = path.join(__dirname, 'docs');

// Website subdirectories
const imgDir = path.join(websiteDir, 'img');
const cssDir = path.join(websiteDir, 'css');
const jsDir = path.join(websiteDir, 'js');

// Ensure all website directories exist
function ensureDirectories() {
  console.log('Ensuring all website directories exist...');
  
  [websiteDir, imgDir, cssDir, jsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      console.log(`Creating directory: ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

// Check if SVG files need to be created
function checkSvgFiles() {
  console.log('Checking SVG files...');
  
  const svgFiles = [
    'neo-mcp-illustration.svg',
    'mcp-architecture.svg',
    'icon-blockchain.svg',
    'icon-contract.svg',
    'icon-network.svg',
    'icon-protocol.svg',
    'logo-placeholder.svg'
  ];
  
  let allFilesExist = true;
  
  for (const file of svgFiles) {
    const filePath = path.join(imgDir, file);
    if (!fs.existsSync(filePath)) {
      console.log(`Missing SVG file: ${file}`);
      allFilesExist = false;
    }
  }
  
  return allFilesExist;
}

// Create SVG templates if they don't exist
function createSvgTemplates() {
  console.log('Creating SVG templates...');
  
  // Neo N3 MCP Illustration
  createSvgFile('neo-mcp-illustration.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600" fill="none">
  <rect width="800" height="600" fill="#f5f7fa"/>
  <circle cx="400" cy="300" r="150" fill="#edf8ff" opacity="0.5"/>
  <path d="M250 150L400 225V450L250 525L100 450V225L250 150Z" stroke="#00e599" stroke-width="4" fill="#00e59910"/>
  <path d="M550 150L700 225V450L550 525L400 450V225L550 150Z" stroke="#5a70b2" stroke-width="4" fill="#5a70b210"/>
  <path d="M250 150V525" stroke="#00e599" stroke-width="4" stroke-dasharray="8 8"/>
  <path d="M400 225L550 150" stroke="#5a70b2" stroke-width="4"/>
  <path d="M400 450L550 525" stroke="#5a70b2" stroke-width="4"/>
  <circle cx="250" cy="150" r="15" fill="#00e599"/>
  <circle cx="400" cy="225" r="15" fill="#00e599"/>
  <circle cx="400" cy="450" r="15" fill="#00e599"/>
  <circle cx="250" cy="525" r="15" fill="#00e599"/>
  <circle cx="100" cy="450" r="15" fill="#00e599"/>
  <circle cx="100" cy="225" r="15" fill="#00e599"/>
  <circle cx="550" cy="150" r="15" fill="#5a70b2"/>
  <circle cx="700" cy="225" r="15" fill="#5a70b2"/>
  <circle cx="700" cy="450" r="15" fill="#5a70b2"/>
  <circle cx="550" cy="525" r="15" fill="#5a70b2"/>
  <text x="400" y="560" text-anchor="middle" font-size="24" font-family="Arial" fill="#222">Neo N3 MCP Server</text>
  <text x="400" y="590" text-anchor="middle" font-size="16" font-family="Arial" fill="#555">Blockchain Access Through MCP Protocol</text>
</svg>`);

  // MCP Architecture
  createSvgFile('mcp-architecture.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500" fill="none">
  <rect width="800" height="500" fill="#f5f7fa"/>
  <rect x="60" y="100" width="160" height="100" rx="10" fill="white" stroke="#5a70b2" stroke-width="3"/>
  <text x="140" y="150" text-anchor="middle" font-size="18" font-family="Arial" font-weight="bold" fill="#5a70b2">AI System</text>
  <text x="140" y="175" text-anchor="middle" font-size="14" font-family="Arial" fill="#666">LangChain, LlamaIndex, etc.</text>
  <rect x="320" y="100" width="160" height="100" rx="10" fill="white" stroke="#5a70b2" stroke-width="3"/>
  <text x="400" y="150" text-anchor="middle" font-size="18" font-family="Arial" font-weight="bold" fill="#5a70b2">MCP Client</text>
  <text x="400" y="175" text-anchor="middle" font-size="14" font-family="Arial" fill="#666">Protocol Handler</text>
  <rect x="580" y="100" width="160" height="100" rx="10" fill="white" stroke="#00e599" stroke-width="3"/>
  <text x="660" y="150" text-anchor="middle" font-size="18" font-family="Arial" font-weight="bold" fill="#00e599">Neo N3 MCP</text>
  <text x="660" y="175" text-anchor="middle" font-size="14" font-family="Arial" fill="#666">Server</text>
  <rect x="320" y="300" width="160" height="100" rx="10" fill="white" stroke="#00e599" stroke-width="3"/>
  <text x="400" y="350" text-anchor="middle" font-size="18" font-family="Arial" font-weight="bold" fill="#00e599">Neo N3</text>
  <text x="400" y="375" text-anchor="middle" font-size="14" font-family="Arial" fill="#666">Blockchain</text>
  
  <!-- Arrows using path instead of arrow element -->
  <defs>
    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="#5a70b2"/>
    </marker>
    <marker id="greenarrow" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="#00e599"/>
    </marker>
  </defs>
  
  <path d="M220 150 L320 150" stroke="#5a70b2" stroke-width="3" marker-end="url(#arrowhead)"/>
  <path d="M480 150 L580 150" stroke="#5a70b2" stroke-width="3" marker-end="url(#arrowhead)"/>
  <path d="M660 200 L660 275 L480 300" stroke="#00e599" stroke-width="3" marker-end="url(#greenarrow)"/>
  <path d="M400 200 L400 300" stroke="#00e599" stroke-width="3" marker-end="url(#greenarrow)"/>
  
  <!-- Text labels -->
  <text x="270" y="130" text-anchor="middle" font-size="12" font-family="Arial" fill="#666">Requests</text>
  <text x="530" y="130" text-anchor="middle" font-size="12" font-family="Arial" fill="#666">MCS PX</text>
  <text x="700" y="240" text-anchor="middle" font-size="12" font-family="Arial" fill="#666">RPC Calls</text>
  <text x="420" y="240" text-anchor="middle" font-size="12" font-family="Arial" fill="#666">Transactions</text>
  <text x="400" y="450" text-anchor="middle" font-size="24" font-family="Arial" font-weight="bold" fill="#333">MCP Architecture</text>
  <text x="400" y="475" text-anchor="middle" font-size="14" font-family="Arial" fill="#666">Powered by R3E Network</text>
</svg>`);

  // Other icons
  createSvgFile('icon-blockchain.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" fill="none">
  <path d="M24 6L36 13.5V28.5L24 36L12 28.5V13.5L24 6Z" stroke="#00e599" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M24 16L36 23.5M24 16L12 23.5M24 16V6" stroke="#00e599" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M24 36V26M24 26L36 18.5M24 26L12 18.5" stroke="#00e599" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`);

  createSvgFile('icon-contract.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" fill="none">
  <path d="M32 6H16C14.9391 6 13.9217 6.42143 13.1716 7.17157C12.4214 7.92172 12 8.93913 12 10V38C12 39.0609 12.4214 40.0783 13.1716 40.8284C13.9217 41.5786 14.9391 42 16 42H32C33.0609 42 34.0783 41.5786 34.8284 40.8284C35.5786 40.0783 36 39.0609 36 38V10C36 8.93913 35.5786 7.92172 34.8284 7.17157C34.0783 6.42143 33.0609 6 32 6Z" stroke="#00e599" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M18 16H30" stroke="#00e599" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M18 24H30" stroke="#00e599" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M18 32H26" stroke="#00e599" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`);

  createSvgFile('icon-network.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" fill="none">
  <path d="M24 30C27.3137 30 30 27.3137 30 24C30 20.6863 27.3137 18 24 18C20.6863 18 18 20.6863 18 24C18 27.3137 20.6863 30 24 30Z" stroke="#00e599" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M37 37C35.9033 35.5272 34.5013 34.3185 32.8955 33.4611C31.2897 32.6037 29.5166 32.1177 27.71 32.03" stroke="#00e599" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M11 37C12.0967 35.5272 13.4987 34.3185 15.1045 33.4611C16.7103 32.6037 18.4834 32.1177 20.29 32.03" stroke="#00e599" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M37 11C35.9033 12.4728 34.5013 13.6815 32.8955 14.5389C31.2897 15.3963 29.5166 15.8823 27.71 15.97" stroke="#00e599" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M11 11C12.0967 12.4728 13.4987 13.6815 15.1045 14.5389C16.7103 15.3963 18.4834 15.8823 20.29 15.97" stroke="#00e599" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M24 6V12" stroke="#00e599" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M6 24H12" stroke="#00e599" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M24 36V42" stroke="#00e599" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M36 24H42" stroke="#00e599" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`);

  createSvgFile('icon-protocol.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" fill="none">
  <path d="M38 24C38 31.732 31.732 38 24 38C16.268 38 10 31.732 10 24C10 16.268 16.268 10 24 10" stroke="#00e599" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M24 30C27.3137 30 30 27.3137 30 24C30 20.6863 27.3137 18 24 18C20.6863 18 18 20.6863 18 24C18 27.3137 20.6863 30 24 30Z" stroke="#00e599" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M32 10H38V16" stroke="#00e599" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M35 13L44 4" stroke="#00e599" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`);

  createSvgFile('logo-placeholder.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200" fill="none">
  <circle cx="100" cy="100" r="90" fill="#f5f7fa" stroke="#00e599" stroke-width="4"/>
  <path d="M100 30L160 65V135L100 170L40 135V65L100 30Z" stroke="#00e599" stroke-width="6" fill="#00e59910"/>
  <circle cx="100" cy="100" r="35" fill="#1d2033"/>
  <text x="100" y="105" text-anchor="middle" font-size="24" font-family="Arial" font-weight="bold" fill="#00e599">MCP</text>
  <path d="M100 65V30" stroke="#00e599" stroke-width="4"/>
  <path d="M100 170V135" stroke="#00e599" stroke-width="4"/>
  <path d="M40 65L100 30L160 65" stroke="#00e599" stroke-width="4"/>
  <path d="M40 135L100 170L160 135" stroke="#00e599" stroke-width="4"/>
</svg>`);
}

// Utility function to create SVG file
function createSvgFile(filename, content) {
  const filePath = path.join(imgDir, filename);
  
  if (!fs.existsSync(filePath)) {
    console.log(`Creating SVG file: ${filename}`);
    fs.writeFileSync(filePath, content);
  }
}

// Main function
function rebuild() {
  console.log('==== Neo N3 MCP Website Rebuild ====');
  
  // Ensure all directories exist
  ensureDirectories();
  
  // Check if all SVG files exist
  const svgFilesExist = checkSvgFiles();
  
  // Create SVG templates if needed
  if (!svgFilesExist) {
    createSvgTemplates();
  }
  
  console.log('Website rebuild complete!');
}

// Execute the rebuild
rebuild(); 