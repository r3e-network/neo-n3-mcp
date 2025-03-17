#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Default MCP settings file paths
const defaultPaths = {
  windows: path.join(process.env.APPDATA || '', 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json'),
  mac: path.join(process.env.HOME || '', 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
  linux: path.join(process.env.HOME || '', '.config', 'Claude', 'claude_desktop_config.json'),
};

// Get the path to the Neo N3 MCP server
const serverPath = path.resolve(__dirname, '..', 'dist', 'index.js');

// Get the MCP settings file path based on the platform
function getMcpSettingsPath() {
  if (process.platform === 'win32') {
    return defaultPaths.windows;
  } else if (process.platform === 'darwin') {
    return defaultPaths.mac;
  } else {
    return defaultPaths.linux;
  }
}

// Add the Neo N3 MCP server to the MCP settings file
function addToMcpSettings() {
  const mcpSettingsPath = getMcpSettingsPath();
  
  // Check if the MCP settings file exists
  if (!fs.existsSync(mcpSettingsPath)) {
    console.error(`MCP settings file not found at ${mcpSettingsPath}`);
    console.error('Please make sure you have the Claude extension installed and configured.');
    process.exit(1);
  }
  
  // Read the MCP settings file
  let mcpSettings;
  try {
    const mcpSettingsContent = fs.readFileSync(mcpSettingsPath, 'utf8');
    mcpSettings = JSON.parse(mcpSettingsContent);
  } catch (error) {
    console.error(`Error reading MCP settings file: ${error.message}`);
    process.exit(1);
  }
  
  // Add the Neo N3 MCP server to the MCP settings
  if (!mcpSettings.mcpServers) {
    mcpSettings.mcpServers = {};
  }
  
  mcpSettings.mcpServers['neo-n3'] = {
    command: 'node',
    args: [serverPath],
    env: {
      NEO_RPC_URL: 'http://localhost:10332',
      WALLET_PATH: path.resolve(__dirname, '..', 'wallets'),
      NEO_NETWORK: 'mainnet',
    },
    disabled: false,
    autoApprove: [],
  };
  
  // Write the updated MCP settings file
  try {
    fs.writeFileSync(mcpSettingsPath, JSON.stringify(mcpSettings, null, 2), 'utf8');
    console.log(`Neo N3 MCP server added to MCP settings at ${mcpSettingsPath}`);
  } catch (error) {
    console.error(`Error writing MCP settings file: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
addToMcpSettings();
