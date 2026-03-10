import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

describe('published package surface', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const packageJsonPath = path.join(repoRoot, 'package.json');

  test('excludes internal planning and operational docs from npm tarball', () => {
    const packJson = execFileSync('npm', ['pack', '--json', '--dry-run'], {
      cwd: repoRoot,
      encoding: 'utf8'
    });

    const [{ files }] = JSON.parse(packJson) as Array<{ files: Array<{ path: string }> }>;
    const filePaths = files.map((file) => file.path);

    expect(filePaths).toContain('dist/index.js');
    expect(filePaths).toContain('README.md');
    expect(filePaths).toContain('LICENSE');
    expect(filePaths).toContain('node_modules/@cityofzion/neon-js/dist/index.js');
    expect(filePaths).toContain('node_modules/@cityofzion/neon-js/package.json');

    expect(filePaths).not.toContain('docs/plans/2026-03-06-production-hardening-followup.md');
    expect(filePaths).not.toContain('docs/IMPROVEMENTS_APPLIED.md');
    expect(filePaths).not.toContain('docs/PRODUCTION_READINESS_REPORT.md');
    expect(filePaths.some((filePath) => filePath.startsWith('docs/plans/'))).toBe(false);
  });

  test('declares typed entrypoints and package metadata for consumers', () => {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as Record<string, any>;

    expect(packageJson.types).toBe('dist/index.d.ts');
    expect(packageJson.exports).toEqual({
      '.': {
        types: './dist/index.d.ts',
        default: './dist/index.js'
      },
      './package.json': './package.json'
    });
    expect(packageJson.engines).toEqual({
      node: '>=18'
    });
    expect(packageJson.repository).toEqual({
      type: 'git',
      url: 'git+https://github.com/r3e-network/neo-n3-mcp.git'
    });
    expect(packageJson.homepage).toBe('https://github.com/r3e-network/neo-n3-mcp#readme');
    expect(packageJson.bugs).toEqual({
      url: 'https://github.com/r3e-network/neo-n3-mcp/issues'
    });
  });
});
