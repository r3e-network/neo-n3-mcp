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

const version = packageJson.version;
const dockerImage = "r3e/neo-n3-mcp";
const dockerTag = `${dockerImage}:${version}`;
const dockerLatest = `${dockerImage}:latest`;

console.log(`Building Docker image ${dockerTag}...`);

try {
  // Build the Docker image
  execSync(`docker build -t ${dockerTag} -t ${dockerLatest} ${rootDir}`, { 
    stdio: 'inherit',
    cwd: rootDir
  });

  console.log('\nDocker image built successfully.');
  console.log('To push to Docker Hub, run:');
  console.log(`docker push ${dockerTag}`);
  console.log(`docker push ${dockerLatest}`);
} catch (error) {
  console.error('Error building Docker image:', error.message);
  process.exit(1);
} 