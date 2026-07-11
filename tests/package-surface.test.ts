import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
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
    // neon-js is now a regular npm dependency, not bundled
    expect(filePaths.some((filePath) => filePath.startsWith('node_modules/'))).toBe(false);
    // no vendored dependencies in tarball
    expect(filePaths.some((filePath) => filePath.startsWith('vendor/'))).toBe(false);
    // no config or example extras
    expect(filePaths.some((filePath) => filePath.startsWith('config/'))).toBe(false);
    expect(filePaths.some((filePath) => filePath.startsWith('examples/'))).toBe(false);

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
      node: '>=22'
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

  test('does not leak undeclared transitive SDK imports through declarations', () => {
    execFileSync('npm', ['run', 'build'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    const declarationFiles: string[] = [];
    const visit = (directory: string) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          visit(entryPath);
        } else if (entry.name.endsWith('.d.ts')) {
          declarationFiles.push(entryPath);
        }
      }
    };
    visit(path.join(repoRoot, 'dist'));

    const leakedFiles = declarationFiles.filter((file) =>
      fs.readFileSync(file, 'utf8').includes('@cityofzion/neon-core')
    );
    expect(leakedFiles.map((file) => path.relative(repoRoot, file))).toEqual([]);
  });

  test('typechecks a strict consumer against the packed package', () => {
    const consumerRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'neo-n3-mcp-consumer-'));
    try {
      execFileSync('npm', ['pack', '--silent', '--pack-destination', consumerRoot], {
        cwd: repoRoot,
        encoding: 'utf8',
      });
      const tarball = fs.readdirSync(consumerRoot).find((entry) => entry.endsWith('.tgz'));
      expect(tarball).toBeDefined();

      fs.writeFileSync(path.join(consumerRoot, 'package.json'), JSON.stringify({
        name: 'neo-n3-mcp-type-consumer',
        private: true,
        dependencies: {
          '@r3e/neo-n3-mcp': `file:./${tarball}`,
          '@types/node': '^22.20.1',
        },
      }, null, 2));
      fs.writeFileSync(path.join(consumerRoot, 'index.ts'), [
        "import { EncodedNef, FeeEstimate, HttpServerOptions, NeoNetwork, NeoService } from '@r3e/neo-n3-mcp';",
        "const options: HttpServerOptions = { host: '127.0.0.1', maxBodyBytes: 1024 };",
        "const nef: EncodedNef = { encoding: 'hex', data: '00' };",
        "const fees: FeeEstimate = { networkFeeDatos: '1', systemFeeDatos: '2', networkFeeGas: '0.00000001', systemFeeGas: '0.00000002' };",
        "const service = new NeoService('https://rpc.example', NeoNetwork.TESTNET);",
        'void options;',
        'void nef;',
        'void fees;',
        'void service.getBlockCount();',
        '',
      ].join('\n'));
      fs.writeFileSync(path.join(consumerRoot, 'tsconfig.json'), JSON.stringify({
        compilerOptions: {
          strict: true,
          noEmit: true,
          target: 'ES2022',
          module: 'Node16',
          moduleResolution: 'Node16',
          skipLibCheck: false,
        },
        files: ['index.ts'],
      }, null, 2));

      execFileSync('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund'], {
        cwd: consumerRoot,
        encoding: 'utf8',
      });
      execFileSync(path.join(repoRoot, 'node_modules', '.bin', 'tsc'), ['--project', 'tsconfig.json'], {
        cwd: consumerRoot,
        encoding: 'utf8',
      });
    } finally {
      fs.rmSync(consumerRoot, { recursive: true, force: true });
    }
  }, 60_000);

  test('exports a usable programmatic server and service API', () => {
    const publicApi = require('../src/index') as Record<string, unknown>;

    expect(publicApi).toEqual(expect.objectContaining({
      NeoN3McpServer: expect.any(Function),
      NeoService: expect.any(Function),
      WalletService: expect.any(Function),
      ContractService: expect.any(Function),
      HttpServer: expect.any(Function),
      NeoNetwork: expect.any(Object),
      NetworkMode: expect.any(Object),
      config: expect.any(Object),
      validateConfig: expect.any(Function),
    }));
    expect((publicApi.NeoN3McpServer as { prototype: Record<string, unknown> }).prototype)
      .toEqual(expect.objectContaining({
        run: expect.any(Function),
        close: expect.any(Function),
      }));
  });

  test('keeps deterministic MCP checks separate from live and stress suites', () => {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as Record<string, any>;

    expect(packageJson.scripts['test:mcp']).toContain('mcp-build-smoke.test.ts');
    expect(packageJson.scripts['test:mcp']).toContain('mcp-lifecycle.test.ts');
    expect(packageJson.scripts['test:mcp']).toContain('mcp-tool-registration.test.ts');
    expect(packageJson.scripts['test:mcp']).not.toContain('mcp-stress.test.ts');
    expect(packageJson.scripts['test:mcp']).not.toContain('mcp-comprehensive.test.ts');
    expect(packageJson.scripts['test:mcp:live']).toContain('mcp-comprehensive.test.ts');
    expect(packageJson.scripts['test:mcp:stress']).toContain('mcp-stress.test.ts');
  });
});
