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
