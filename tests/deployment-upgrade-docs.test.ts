import fs from 'fs';
import path from 'path';

// `npm run build` runs `clean` first, which deletes dist/, and then needs `tsc` from
// devDependencies. A host whose node_modules was pruned to production deps therefore
// loses the running build and cannot produce a new one: the clean succeeds, tsc is
// missing, and the service restarts onto an empty dist/. Repeating the same two commands
// as a rollback fails identically. The deployment guide has to spell out the full-install
// -> build -> prune order so an in-place upgrade cannot take a host down this way.
const repoRoot = path.resolve(__dirname, '..');

const UPGRADE_HEADING = '## Upgrading an Existing Deployment';

function readDeploymentGuide(): string {
  return fs.readFileSync(path.join(repoRoot, 'docs', 'DEPLOYMENT.md'), 'utf8');
}

function readUpgradeSection(): string {
  const guide = readDeploymentGuide();
  const start = guide.indexOf(UPGRADE_HEADING);
  if (start < 0) {
    throw new Error(`docs/DEPLOYMENT.md is missing the "${UPGRADE_HEADING}" section`);
  }
  const next = guide.indexOf('\n## ', start + UPGRADE_HEADING.length);
  return next < 0 ? guide.slice(start) : guide.slice(start, next);
}

// The prose above the commands names the failure mode first, so ordering has to be
// asserted against the runnable block rather than the whole section.
function readUpgradeCommandBlock(): string {
  const section = readUpgradeSection();
  const fence = /```(?:bash|sh|console)?\n([\s\S]*?)```/.exec(section);
  if (!fence) {
    throw new Error(`the "${UPGRADE_HEADING}" section has no fenced command block`);
  }
  return fence[1];
}

const HETZNER_RELEASE_HEADING = '## 3. 发布新版本';

function readHetznerReleaseBlock(): string {
  const guide = fs.readFileSync(path.join(repoRoot, 'DEPLOY_TO_HETZNER.md'), 'utf8');
  const start = guide.indexOf(HETZNER_RELEASE_HEADING);
  if (start < 0) {
    throw new Error(`DEPLOY_TO_HETZNER.md is missing the "${HETZNER_RELEASE_HEADING}" section`);
  }
  const next = guide.indexOf('\n## ', start + HETZNER_RELEASE_HEADING.length);
  const section = next < 0 ? guide.slice(start) : guide.slice(start, next);
  const fence = /```(?:bash|sh|console)?\n([\s\S]*?)```/.exec(section);
  if (!fence) {
    throw new Error(`the "${HETZNER_RELEASE_HEADING}" section has no fenced command block`);
  }
  return fence[1];
}

describe('in-place upgrade documentation', () => {
  test('build script still deletes dist and depends on a dev-only compiler', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')
    ) as {
      scripts: Record<string, string>;
      devDependencies: Record<string, string>;
      dependencies: Record<string, string>;
    };

    expect(manifest.scripts.build).toContain('clean');
    expect(manifest.scripts.build).toContain('tsc');
    expect(manifest.scripts.clean).toContain('rmSync');
    expect(manifest.devDependencies.typescript).toBeDefined();
    expect(manifest.dependencies.typescript).toBeUndefined();
  });

  test('guide documents the upgrade order for an existing deployment', () => {
    expect(readDeploymentGuide()).toContain(UPGRADE_HEADING);
    expect(readUpgradeSection()).toContain('npm prune --omit=dev');
  });

  test('commands order the full install before the build and the prune after it', () => {
    const block = readUpgradeCommandBlock();

    const install = block.search(/^\s*npm ci\s*(#|$)/m);
    const build = block.indexOf('npm run build');
    const prune = block.indexOf('npm prune --omit=dev');

    expect(install).toBeGreaterThanOrEqual(0);
    expect(build).toBeGreaterThan(install);
    expect(prune).toBeGreaterThan(build);
  });

  test('guide warns against installing without dev dependencies before building', () => {
    const section = readUpgradeSection();

    expect(section).toContain('npm ci --omit=dev');
    expect(section).toMatch(/tsc: not found|tsc` is missing|without `tsc`/);
  });

  test('commands verify dist before restarting the service', () => {
    const block = readUpgradeCommandBlock();

    const verify = block.indexOf('dist/mcp-http.js');
    const restart = block.indexOf('systemctl restart');

    expect(verify).toBeGreaterThanOrEqual(0);
    expect(restart).toBeGreaterThan(verify);
  });
});

// The Hetzner runbook is what an operator actually follows on the host that runs the
// service, so it has to carry the same order as the generic guide.
describe('Hetzner release runbook', () => {
  test('uses no invalid npm omit syntax', () => {
    const block = readHetznerReleaseBlock();

    // `--omit=dev=false` is not a valid value: npm warns "invalid config" and ignores the
    // flag, so it only happens to install dev dependencies. Anyone "correcting" it to
    // `--omit=dev` would strip tsc and take the host down on the next build.
    expect(block).not.toContain('--omit=dev=false');
    expect(block).not.toMatch(/npm ci[^\n]*--omit=dev(?!\S)/);
  });

  test('installs the full tree, builds, verifies, then prunes before restarting', () => {
    const block = readHetznerReleaseBlock();

    const install = block.search(/^\s*npm ci\s*(#|$)/m);
    const build = block.indexOf('npm run build');
    const verify = block.indexOf('dist/mcp-http.js');
    const prune = block.indexOf('npm prune --omit=dev');
    const restart = block.indexOf('systemctl restart');

    expect(install).toBeGreaterThanOrEqual(0);
    expect(build).toBeGreaterThan(install);
    expect(verify).toBeGreaterThan(build);
    expect(prune).toBeGreaterThan(verify);
    expect(restart).toBeGreaterThan(prune);
  });

  test('resets to the tracked remote instead of pulling into a drifted checkout', () => {
    const block = readHetznerReleaseBlock();

    expect(block).toContain('git reset --hard origin/master');
  });
});
