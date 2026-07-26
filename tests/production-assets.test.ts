import { execFileSync, spawnSync } from 'child_process';
import { createHash, timingSafeEqual } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const NEO_PRIVATE_KEY_ORDER = Buffer.from(
  'ffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551',
  'hex'
);
const WIF_CANDIDATE_PATTERN =
  /(?<![1-9A-HJ-NP-Za-km-z])[KL][1-9A-HJ-NP-Za-km-z]{51}(?![1-9A-HJ-NP-Za-km-z])/g;
const LOCKFILE_NAMES = new Set([
  'bun.lock',
  'bun.lockb',
  'npm-shrinkwrap.json',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
]);
const GENERATED_DIRECTORY_NAMES = new Set(['coverage', 'dist', 'node_modules', 'vendor']);
const PINNED_NODE_IMAGE =
  'node:22-alpine@sha256:4d64b49e6c891c8fc821007cb1cdc6c0db7773110ac2c34bf2e6960adef62ed3';

type DockerReplacementScenario =
  | 'healthy'
  | 'run-fails'
  | 'unhealthy'
  | 'readiness-fails'
  | 'rollback-start-fails';

function runDockerReplacementScenario(repoRoot: string, scenario: DockerReplacementScenario) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'neo-n3-docker-run-'));
  const dockerPath = path.join(directory, 'docker');
  const callLogPath = path.join(directory, 'docker-calls');
  const containerName = 'neo-mcp-server';
  const fakeDocker = [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    'printf \'%s\\n\' "$*" >> "$DOCKER_CALL_LOG"',
    'case "$1" in',
    '  container)',
    '    if [[ "$2" == inspect ]]; then',
    '      target="${@: -1}"',
    '      [[ "$target" == "$TARGET_CONTAINER" ]] && exit 0',
    '      exit 1',
    '    fi',
    '    ;;',
    '  inspect)',
    '    if [[ "$*" == *".State.Health"* ]]; then',
    '      printf \'true %s\\n\' "$HEALTH_STATUS"',
    '    else',
    '      printf \'true\\n\'',
    '    fi',
    '    ;;',
    '  run)',
    '    [[ "$FAKE_DOCKER_SCENARIO" == run-fails || "$FAKE_DOCKER_SCENARIO" == rollback-start-fails ]] && exit 42',
    '    printf \'replacement-id\\n\'',
    '    ;;',
    '  exec)',
    '    [[ "$FAKE_DOCKER_SCENARIO" == readiness-fails ]] && exit 43',
    '    exit 0',
    '    ;;',
    '  start)',
    '    [[ "$FAKE_DOCKER_SCENARIO" == rollback-start-fails ]] && exit 44',
    '    ;;',
    '  rename|stop|rm|attach)',
    '    ;;',
    'esac',
  ].join('\n');

  fs.writeFileSync(dockerPath, fakeDocker, { mode: 0o755 });

  try {
    const result = spawnSync(
      'bash',
      [path.join(repoRoot, 'scripts/docker-run.sh'), '--replace', '--detach'],
      {
        cwd: repoRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          DOCKER_CALL_LOG: callLogPath,
          FAKE_DOCKER_SCENARIO: scenario,
          HEALTH_STATUS: scenario === 'unhealthy' ? 'unhealthy' : 'healthy',
          HTTP_API_KEY: 'test-only-api-key-0000000000000000',
          NEO_MCP_REPLACEMENT_ATTEMPTS: '1',
          PATH: `${directory}:${process.env.PATH ?? ''}`,
          TARGET_CONTAINER: containerName,
        },
      }
    );
    const calls = fs.existsSync(callLogPath)
      ? fs.readFileSync(callLogPath, 'utf8').trim().split('\n').filter(Boolean)
      : [];

    return { calls, containerName, result };
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function sha256(value: Buffer): Buffer {
  return createHash('sha256').update(value).digest();
}

function encodeBase58(value: Buffer): string {
  let encoded = '';
  let numericValue = BigInt(`0x${value.toString('hex')}`);

  while (numericValue > 0n) {
    const remainder = Number(numericValue % 58n);
    encoded = BASE58_ALPHABET[remainder] + encoded;
    numericValue /= 58n;
  }

  for (const byte of value) {
    if (byte !== 0) break;
    encoded = `1${encoded}`;
  }

  return encoded;
}

function encodeWifForTest(privateKey: Buffer, version = 0x80): string {
  const payload = Buffer.concat([Buffer.from([version]), privateKey, Buffer.from([0x01])]);
  const checksum = sha256(sha256(payload)).subarray(0, 4);
  return encodeBase58(Buffer.concat([payload, checksum]));
}

function decodeBase58(value: string): Buffer | undefined {
  let decoded = 0n;

  for (const character of value) {
    const digit = BASE58_ALPHABET.indexOf(character);
    if (digit < 0) return undefined;
    decoded = decoded * 58n + BigInt(digit);
  }

  const bytes: number[] = [];
  while (decoded > 0n) {
    bytes.push(Number(decoded % 256n));
    decoded /= 256n;
  }
  bytes.reverse();

  let leadingZeroCount = 0;
  while (value[leadingZeroCount] === '1') leadingZeroCount += 1;

  return Buffer.concat([Buffer.alloc(leadingZeroCount), Buffer.from(bytes)]);
}

function isNeoWif(candidate: string): boolean {
  if (!/^[KL][1-9A-HJ-NP-Za-km-z]{51}$/.test(candidate)) return false;

  const decoded = decodeBase58(candidate);
  if (!decoded || decoded.length !== 38) return false;

  const payload = decoded.subarray(0, 34);
  const checksum = decoded.subarray(34);
  const expectedChecksum = sha256(sha256(payload)).subarray(0, 4);
  if (!timingSafeEqual(checksum, expectedChecksum)) return false;

  const privateKey = payload.subarray(1, 33);
  return (
    payload[0] === 0x80 &&
    payload[33] === 0x01 &&
    privateKey.some((byte) => byte !== 0) &&
    Buffer.compare(privateKey, NEO_PRIVATE_KEY_ORDER) < 0
  );
}

function isExcludedTrackedFile(relativePath: string): boolean {
  const segments = relativePath.split('/');
  return (
    LOCKFILE_NAMES.has(segments[segments.length - 1]) ||
    segments.some((segment) => GENERATED_DIRECTORY_NAMES.has(segment))
  );
}

function findNeoWifLines(contents: string): number[] {
  const lines: number[] = [];

  for (const match of contents.matchAll(WIF_CANDIDATE_PATTERN)) {
    if (!isNeoWif(match[0])) continue;
    lines.push(contents.slice(0, match.index).split('\n').length);
  }

  return lines;
}

describe('production assets', () => {
  const repoRoot = path.resolve(__dirname, '..');

  test('recognizes only valid compressed Neo WIF values', () => {
    const privateKey = Buffer.alloc(32);
    privateKey[31] = 1;
    const wif = encodeWifForTest(privateKey);
    const invalidChecksum = `${wif.slice(0, -1)}${wif.endsWith('1') ? '2' : '1'}`;

    expect(wif).toHaveLength(52);
    expect(isNeoWif(wif)).toBe(true);
    expect(isNeoWif(invalidChecksum)).toBe(false);
    expect(isNeoWif(encodeWifForTest(privateKey, 0x81))).toBe(false);
    expect(isNeoWif(encodeWifForTest(Buffer.alloc(32)))).toBe(false);
    expect(isNeoWif('K'.repeat(52))).toBe(false);
  });

  test('tracked production assets do not contain Neo WIF private keys', () => {
    const trackedFiles = execFileSync('git', ['ls-files', '-z'], {
      cwd: repoRoot,
      encoding: 'utf8',
    })
      .split('\0')
      .filter((relativePath) => relativePath && !isExcludedTrackedFile(relativePath));
    const findings: string[] = [];

    for (const relativePath of trackedFiles) {
      const absolutePath = path.join(repoRoot, relativePath);
      if (!fs.existsSync(absolutePath) || !fs.lstatSync(absolutePath).isFile()) continue;

      const contents = fs.readFileSync(absolutePath);
      if (contents.includes(0)) continue;

      for (const line of findNeoWifLines(contents.toString('utf8'))) {
        findings.push(`${relativePath}:${line}`);
      }
    }

    expect(findings).toEqual([]);
  });

  test.each(['docker/Dockerfile', 'docker/Dockerfile.dev'])(
    '%s uses the supported runtime and only existing build inputs',
    (relativePath) => {
      const dockerfile = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
      const fromLines = dockerfile.match(/^FROM .+$/gm) ?? [];

      expect(fromLines.length).toBeGreaterThan(0);
      for (const fromLine of fromLines) {
        expect(fromLine).toMatch(
          new RegExp(`^FROM ${PINNED_NODE_IMAGE.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}(?: AS \\w+)?$`)
        );
      }
      expect(dockerfile).not.toContain('apk add');
      expect(dockerfile).not.toContain('dumb-init');
      expect(dockerfile).toMatch(/^CMD \["node",/m);
      expect(dockerfile).not.toContain('vendor/');
      expect(dockerfile).not.toContain('babel.config.cjs');
      expect(dockerfile).toContain("http://127.0.0.1:3000/live");
    }
  );

  test.each(['docker/docker-compose.yml', 'docker/docker-compose.dev.yml'])(
    '%s resolves builds from the repository root',
    (relativePath) => {
      const compose = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
      const dockerfile = relativePath.endsWith('.dev.yml')
        ? 'docker/Dockerfile.dev'
        : 'docker/Dockerfile';

      expect(compose).toContain('context: ..');
      expect(compose).toContain(`dockerfile: ${dockerfile}\n`);
      expect(compose).not.toMatch(/^version:/m);
    }
  );

  test('production Compose requires an API key when exposing the HTTP server', () => {
    const compose = fs.readFileSync(
      path.join(repoRoot, 'docker/docker-compose.yml'),
      'utf8'
    );

    expect(compose).toContain('HTTP_HOST=0.0.0.0');
    expect(compose).toContain('HTTP_API_KEY=${HTTP_API_KEY:?');
    expect(compose).toContain('WALLETS_DIR=/app/wallets');
    expect(compose).toContain("http://127.0.0.1:3000/live");
  });

  test('the production image has a concrete HTTP network default', () => {
    const dockerfile = fs.readFileSync(path.join(repoRoot, 'docker/Dockerfile'), 'utf8');

    expect(dockerfile).toContain('NEO_NETWORK=mainnet');
  });

  test('production Compose requires a structurally digest-pinned registry image', () => {
    const compose = fs.readFileSync(
      path.join(repoRoot, 'docker/docker-compose.yml'),
      'utf8'
    );
    const registryCompose = fs.readFileSync(
      path.join(repoRoot, 'docker/docker-compose.registry.yml'),
      'utf8'
    );

    expect(compose).toContain('image: neo-mcp:local');
    expect(compose).toContain('pull_policy: build');
    expect(registryCompose).toContain('build: !reset null');
    expect(registryCompose).toMatch(
      /^    image: "\${NEO_MCP_IMAGE_REPOSITORY:\?[^}]+}@sha256:\${NEO_MCP_IMAGE_DIGEST:\?[^}]+}"$/m
    );
    expect(registryCompose).not.toMatch(/\${NEO_MCP_IMAGE:\?/);
    expect(registryCompose).toContain('pull_policy: always');
    expect(compose).toContain('NEO_NETWORK=${NEO_NETWORK:-mainnet}');
    expect(compose).toContain('NEO_MAINNET_RPC=${NEO_MAINNET_RPC:-');
    expect(compose).toContain('NEO_TESTNET_RPC=${NEO_TESTNET_RPC:-');
    expect(compose).toContain('NEO_RPC_TIMEOUT_MS=${NEO_RPC_TIMEOUT_MS:-15000}');
    expect(compose).toContain('HTTP_MAX_BODY_BYTES=${HTTP_MAX_BODY_BYTES:-1048576}');
  });

  test('production Compose bounds resources and confines the container filesystem', () => {
    const compose = fs.readFileSync(
      path.join(repoRoot, 'docker/docker-compose.yml'),
      'utf8'
    );

    expect(compose).toContain('stop_grace_period: "${STOP_GRACE_PERIOD:-30s}"');
    expect(compose).toContain('pids_limit: ${PIDS_LIMIT:-256}');
    expect(compose).toContain('mem_limit: "${MEMORY_LIMIT:-512m}"');
    expect(compose).toContain('cpus: ${CPU_LIMIT:-1.0}');
    expect(compose).toContain('read_only: true');
    expect(compose).toContain('cap_drop:');
    expect(compose).toContain('- ALL');
    expect(compose).toContain('no-new-privileges:true');
    expect(compose).toContain('/tmp:rw,noexec,nosuid,size=64m');
    expect(compose).toContain('neo-mcp-wallets:/app/wallets');
  });

  test('Docker helper scripts avoid shell evaluation and build-context mutation', () => {
    const buildScript = fs.readFileSync(path.join(repoRoot, 'scripts/docker-build.sh'), 'utf8');
    const runScript = fs.readFileSync(path.join(repoRoot, 'scripts/docker-run.sh'), 'utf8');

    expect(buildScript).not.toContain('mv .dockerignore');
    expect(buildScript).not.toContain('cp docker/.dockerignore');
    expect(runScript).not.toMatch(/\beval\b/);
    expect(runScript).toContain('HTTP_API_KEY');
  });

  test('development Docker build and run scripts use the same image tag', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')
    ) as { scripts: Record<string, string> };

    expect(packageJson.scripts['docker:build:dev']).toContain('--tag dev');
    expect(packageJson.scripts['docker:run:dev']).toContain('--image neo-mcp:dev');
  });

  test('the Docker run helper applies the production confinement defaults', () => {
    const runScript = fs.readFileSync(path.join(repoRoot, 'scripts/docker-run.sh'), 'utf8');

    expect(runScript).toContain('--read-only');
    expect(runScript).toMatch(
      /--tmpfs\s+["']?\/tmp:rw,noexec,nosuid,size=64m,mode=1777["']?/
    );
    expect(runScript).toContain('--cap-drop ALL');
    expect(runScript).toContain('--security-opt no-new-privileges:true');
    expect(runScript).toContain('--pids-limit 256');
    expect(runScript).toContain('--memory 512m');
    expect(runScript).toContain('--cpus 1');
    expect(runScript).toContain('--stop-timeout 30');
  });

  test('the Docker run helper restores the previous container when replacement launch fails', () => {
    const { calls, containerName, result } = runDockerReplacementScenario(repoRoot, 'run-fails');
    const renameToBackup = calls.find((call) =>
      call.startsWith(`rename ${containerName} ${containerName}-replace-backup-`)
    );

    expect(result.status).not.toBe(0);
    expect(renameToBackup).toBeDefined();
    const backupName = renameToBackup?.split(' ')[2];
    expect(calls).toContain(`rename ${backupName} ${containerName}`);
    expect(calls).toContain(`start ${containerName}`);
    expect(calls.indexOf(`rm --force ${containerName}`)).toBeGreaterThan(
      calls.findIndex((call) => call.startsWith('run '))
    );
  });

  test('the Docker run helper restores the previous container when replacement health fails', () => {
    const { calls, containerName, result } = runDockerReplacementScenario(repoRoot, 'unhealthy');
    const renameToBackup = calls.find((call) =>
      call.startsWith(`rename ${containerName} ${containerName}-replace-backup-`)
    );
    const backupName = renameToBackup?.split(' ')[2];
    const healthIndex = calls.findIndex(
      (call) => call.startsWith('inspect --format ') && call.includes('.State.Health')
    );

    expect(result.status).not.toBe(0);
    expect(healthIndex).toBeGreaterThanOrEqual(0);
    expect(calls.indexOf(`rm --force ${containerName}`)).toBeGreaterThan(healthIndex);
    expect(calls.indexOf(`rename ${backupName} ${containerName}`)).toBeGreaterThan(healthIndex);
    expect(calls).toContain(`start ${containerName}`);
  });

  test('the Docker run helper restores the previous container when RPC readiness fails', () => {
    const { calls, containerName, result } = runDockerReplacementScenario(repoRoot, 'readiness-fails');
    const readinessIndex = calls.findIndex(
      (call) => call.startsWith(`exec ${containerName} node -e`) && call.includes('/health')
    );
    const renameToBackup = calls.find((call) =>
      call.startsWith(`rename ${containerName} ${containerName}-replace-backup-`)
    );
    const backupName = renameToBackup?.split(' ')[2];

    expect(result.status).not.toBe(0);
    expect(readinessIndex).toBeGreaterThanOrEqual(0);
    expect(calls.indexOf(`rename ${backupName} ${containerName}`)).toBeGreaterThan(readinessIndex);
    expect(calls).toContain(`start ${containerName}`);
  });

  test('the Docker run helper reports a failed restart during rollback', () => {
    const { containerName, result } = runDockerReplacementScenario(repoRoot, 'rollback-start-fails');

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(`Unable to restart restored container ${containerName}`);
    expect(result.stderr).toContain(`remains available as ${containerName}`);
  });

  test('the Docker run helper removes the previous container only after replacement is healthy', () => {
    const { calls, containerName, result } = runDockerReplacementScenario(repoRoot, 'healthy');
    const renameToBackup = calls.find((call) =>
      call.startsWith(`rename ${containerName} ${containerName}-replace-backup-`)
    );
    const backupName = renameToBackup?.split(' ')[2];
    const healthIndex = calls.findIndex(
      (call) => call.startsWith('inspect --format ') && call.includes('.State.Health')
    );

    expect(result.status).toBe(0);
    expect(healthIndex).toBeGreaterThanOrEqual(0);
    expect(calls.indexOf(`rm --force ${backupName}`)).toBeGreaterThan(healthIndex);
    expect(calls).not.toContain(`rm --force ${containerName}`);
  });

  test('release preparation does not create commits on behalf of the operator', () => {
    const releaseScript = fs.readFileSync(
      path.join(repoRoot, 'scripts/prepare-release.sh'),
      'utf8'
    );

    expect(releaseScript).not.toContain('git commit');
    expect(releaseScript).toContain('npm pack --dry-run');
    expect(releaseScript).toMatch(/compose_image_digest=[0-9a-f]{64}/);
    expect(releaseScript).toContain(
      '[[ ! "$compose_image_digest" =~ ^[0-9a-f]{64}$ ]]'
    );
    expect(releaseScript).toContain('NEO_MCP_IMAGE_REPOSITORY=neo-mcp');
    expect(releaseScript).toContain('NEO_MCP_IMAGE_DIGEST="$compose_image_digest"');
    expect(releaseScript).not.toMatch(/\bNEO_MCP_IMAGE=/);
    expect(releaseScript).toContain(
      '-f docker/docker-compose.yml -f docker/docker-compose.registry.yml config'
    );
  });
});
