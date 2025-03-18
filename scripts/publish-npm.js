#!/usr/bin/env node
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Read package.json
const packageJsonPath = path.join(rootDir, 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

console.log(`Preparing to publish ${packageJson.name}@${packageJson.version} to NPM...`);

try {
  // Build the package
  console.log('Building package...');
  execSync('npm run build', { stdio: 'inherit', cwd: rootDir });

  // Publish to NPM
  console.log('Publishing to NPM...');
  execSync('npm publish', { stdio: 'inherit', cwd: rootDir });

  console.log(`Successfully published ${packageJson.name}@${packageJson.version} to NPM!`);
} catch (error) {
  console.error('Error publishing package:', error.message);
  process.exit(1);
} 