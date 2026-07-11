import { spawnSync } from 'child_process';
import { createHash } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

function extractReleaseGateScript(workflow: string): string {
  const stepMarker = '      - name: Validate tag and select publication channels';
  const stepIndex = workflow.indexOf(stepMarker);
  const runMarker = '        run: |\n';
  const scriptStart = workflow.indexOf(runMarker, stepIndex) + runMarker.length;
  const scriptEnd = workflow.indexOf('\n\n  publish:', scriptStart);

  if (stepIndex < 0 || scriptStart < runMarker.length || scriptEnd < 0) {
    throw new Error('Unable to locate the release gate script in the CI workflow');
  }

  return workflow.slice(scriptStart, scriptEnd).replace(/^ {10}/gm, '');
}

function getJobBlock(workflow: string, jobName: string): string {
  const start = workflow.indexOf(`  ${jobName}:`);
  if (start < 0) {
    throw new Error(`Unable to locate the ${jobName} job in the CI workflow`);
  }

  const remaining = workflow.slice(start + 2);
  const nextJob = remaining.search(/\n  [a-z][a-z0-9-]*:\n/);
  return nextJob < 0 ? workflow.slice(start) : workflow.slice(start, start + 2 + nextJob);
}

function extractPromotionVersionScript(workflow: string): string {
  const marker = 'CURRENT_VERSION="$current_version" CANDIDATE_VERSION="$PACKAGE_VERSION" node <<\'NODE\'\n';
  const scriptStart = workflow.indexOf(marker) + marker.length;
  const scriptEnd = workflow.indexOf('\n          NODE', scriptStart);

  if (scriptStart < marker.length || scriptEnd < 0) {
    throw new Error('Unable to locate the promotion version guard in the CI workflow');
  }

  return workflow.slice(scriptStart, scriptEnd).replace(/^ {10}/gm, '');
}

function runPromotionVersionGuard(workflow: string, candidate: string, current: string) {
  return spawnSync('node', ['-e', extractPromotionVersionScript(workflow)], {
    encoding: 'utf8',
    env: {
      ...process.env,
      CANDIDATE_VERSION: candidate,
      CURRENT_VERSION: current,
    },
  });
}

function runReleaseGate(
  workflow: string,
  version: string,
  releaseTag: string,
  releasePrerelease: boolean
) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'neo-n3-release-gate-'));
  const outputPath = path.join(directory, 'github-output');

  try {
    fs.writeFileSync(
      path.join(directory, 'package.json'),
      JSON.stringify({ name: '@r3e/neo-n3-mcp', version })
    );
    const result = spawnSync('bash', ['-euo', 'pipefail', '-c', extractReleaseGateScript(workflow)], {
      cwd: directory,
      encoding: 'utf8',
      env: {
        ...process.env,
        GITHUB_OUTPUT: outputPath,
        RELEASE_PRERELEASE: String(releasePrerelease),
        RELEASE_TAG: releaseTag,
      },
    });

    return {
      output: fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : '',
      status: result.status,
      stderr: result.stderr,
    };
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

describe('CI workflow', () => {
  const workflowPath = path.join(__dirname, '..', '.github', 'workflows', 'ci.yml');

  test('runs the deterministic MCP suite after the build step', () => {
    const workflow = fs.readFileSync(workflowPath, 'utf8');

    const buildStepIndex = workflow.indexOf('- name: Build project');
    const smokeStepIndex = workflow.indexOf('- name: Run deterministic MCP tests');
    const smokeCommandIndex = workflow.indexOf('run: npm run test:mcp');

    expect(buildStepIndex).toBeGreaterThanOrEqual(0);
    expect(smokeStepIndex).toBeGreaterThan(buildStepIndex);
    expect(smokeCommandIndex).toBeGreaterThan(smokeStepIndex);
  });

  test('treats verification failures as fatal and tests supported Node releases', () => {
    const workflow = fs.readFileSync(workflowPath, 'utf8');

    expect(workflow).toContain('node-version: [22.x, 24.x]');
    expect(workflow).not.toContain('|| echo');
    expect(workflow).not.toContain('continue-on-error: true');
  });

  test('uses the lockfile audit without installing transient audit tools', () => {
    const workflow = fs.readFileSync(workflowPath, 'utf8');

    expect(workflow).toContain('run: npm audit --audit-level=high');
    expect(workflow).toContain('run: npm audit --omit=dev --audit-level=high');
    expect(workflow).not.toContain('npx audit-ci');
  });

  test('does not claim to deploy without a real deployment integration', () => {
    const workflow = fs.readFileSync(workflowPath, 'utf8');

    expect(workflow).not.toContain('name: Deploy to Production');
    expect(workflow).not.toContain('Add your deployment steps here');
  });

  test('starts the HTTP container with an explicit Neo network', () => {
    const workflow = fs.readFileSync(workflowPath, 'utf8');

    expect(workflow).toContain('--env NEO_NETWORK=testnet');
  });

  test('validates the registry image digest before rendering Compose configuration', () => {
    const workflow = fs.readFileSync(workflowPath, 'utf8');
    const dockerJob = getJobBlock(workflow, 'docker');

    expect(dockerJob).toContain('NEO_MCP_IMAGE_REPOSITORY: r3enetwork/neo-n3-mcp');
    expect(dockerJob).toContain(
      '[[ ! "$NEO_MCP_IMAGE_DIGEST" =~ ^[0-9a-f]{64}$ ]]'
    );
    expect(dockerJob).not.toMatch(/\bNEO_MCP_IMAGE:/);
  });

  test('validates the release tag against the package version before either publish job', () => {
    const workflow = fs.readFileSync(workflowPath, 'utf8');
    const releaseGateIndex = workflow.indexOf('  release-gate:');
    const npmPublishIndex = workflow.indexOf('  publish:');
    const dockerPublishIndex = workflow.indexOf('  docker-publish:');

    expect(releaseGateIndex).toBeGreaterThanOrEqual(0);
    expect(npmPublishIndex).toBeGreaterThan(releaseGateIndex);
    expect(dockerPublishIndex).toBeGreaterThan(releaseGateIndex);
    expect(workflow).toContain('RELEASE_TAG: ${{ github.event.release.tag_name }}');
    expect(workflow).toContain('NORMALIZED_RELEASE_TAG="${RELEASE_TAG#v}"');
    expect(workflow).toContain('if [[ "$NORMALIZED_RELEASE_TAG" != "$PACKAGE_VERSION" ]]');
    expect(workflow).toContain('needs: release-gate');
  });

  test('uses explicit npm channels and keeps prereleases away from latest', () => {
    const workflow = fs.readFileSync(workflowPath, 'utf8');

    expect(workflow).toContain('NPM_DIST_TAG=next');
    expect(workflow).toContain('NPM_DIST_TAG=latest');
    expect(workflow).toContain(
      'npm publish "$PACKAGE_TARBALL" --access public --provenance --tag "$NPM_STAGING_TAG"'
    );
    expect(getJobBlock(workflow, 'promote-release')).toContain(
      'npm dist-tag add "${PACKAGE_NAME}@${PACKAGE_VERSION}" "$NPM_DIST_TAG"'
    );
  });

  test.each([
    ['stable', '2.1.0', 'v2.1.0', false, 'latest'],
    ['prerelease', '2.1.0-rc.1', 'v2.1.0-rc.1', true, 'next'],
  ])('selects the %s npm channel from the package version', (_name, version, tag, prerelease, npmTag) => {
    const workflow = fs.readFileSync(workflowPath, 'utf8');
    const result = runReleaseGate(workflow, version as string, tag as string, prerelease as boolean);

    expect(result).toMatchObject({ status: 0, stderr: '' });
    expect(result.output).toContain('package-name=@r3e/neo-n3-mcp');
    expect(result.output).toContain(`version=${version}`);
    expect(result.output).toContain(`is-prerelease=${prerelease}`);
    expect(result.output).toContain(`npm-dist-tag=${npmTag}`);
    const stagingHash = createHash('sha256').update(version as string).digest('hex');
    expect(result.output).toContain(
      `npm-staging-tag=release-${stagingHash}`
    );
  });

  test.each([
    ['a mismatched tag', '2.1.0', 'v2.1.1', false, 'does not match package version'],
    ['a mismatched prerelease flag', '2.1.0-rc.1', 'v2.1.0-rc.1', false, 'prerelease status'],
    ['build metadata', '2.1.0+build-1', 'v2.1.0+build-1', false, 'build metadata'],
    ['a leading zero in the major version', '02.1.0', 'v02.1.0', false, 'canonical semantic version'],
    [
      'a leading zero in a numeric prerelease identifier',
      '2.1.0-rc.01',
      'v2.1.0-rc.01',
      true,
      'canonical semantic version',
    ],
    [
      'an empty prerelease identifier',
      '2.1.0-rc..1',
      'v2.1.0-rc..1',
      true,
      'canonical semantic version',
    ],
  ])('rejects %s', (_name, version, tag, prerelease, errorText) => {
    const workflow = fs.readFileSync(workflowPath, 'utf8');
    const result = runReleaseGate(workflow, version as string, tag as string, prerelease as boolean);

    expect(result.status).not.toBe(0);
    expect(result.output).toBe('');
    expect(result.stderr).toContain(errorText);
  });

  test('derives distinct npm candidate tags from distinct exact versions', () => {
    const workflow = fs.readFileSync(workflowPath, 'utf8');
    const versions = ['1.0.0-rc.1', '1.0.0-rc-1', '1.0.0-RC.1', '1.0.0-rc.1'];
    const tags = versions.map((version) => {
      const result = runReleaseGate(workflow, version, `v${version}`, true);
      expect(result.status).toBe(0);
      return result.output.match(/^npm-staging-tag=(.+)$/m)?.[1];
    });

    expect(tags[0]).not.toBe(tags[1]);
    expect(tags[0]).not.toBe(tags[2]);
    expect(tags[0]).toBe(tags[3]);
  });

  test('rejects package versions that cannot be represented as Docker tags', () => {
    const workflow = fs.readFileSync(workflowPath, 'utf8');
    const version = `2.1.0-${'a'.repeat(130)}`;
    const result = runReleaseGate(workflow, version, `v${version}`, true);

    expect(result.status).not.toBe(0);
    expect(result.output).toBe('');
    expect(result.stderr).toContain('valid Docker tag');
  });

  test('publishes floating Docker tags only for stable releases', () => {
    const workflow = fs.readFileSync(workflowPath, 'utf8');
    const dockerPublish = getJobBlock(workflow, 'docker-publish');
    const promote = getJobBlock(workflow, 'promote-release');

    expect(dockerPublish).toContain('"${IMAGE_REPOSITORY}:${IMAGE_VERSION}"');
    expect(dockerPublish).not.toContain(':latest');
    expect(promote).toContain("if: needs.release-gate.outputs.is-prerelease == 'false'");
    expect(promote).toContain('"${IMAGE_REPOSITORY}:latest"');
    expect(promote).toContain('"${IMAGE_REPOSITORY}:${VERSION_MAJOR_MINOR}"');
    expect(promote).toContain('"${IMAGE_REPOSITORY}:${VERSION_MAJOR}"');
  });

  test('publishes the exact package artifact created by the build job', () => {
    const workflow = fs.readFileSync(workflowPath, 'utf8');
    const build = getJobBlock(workflow, 'build');
    const publish = getJobBlock(workflow, 'publish');

    expect(build).toContain('npm pack --json --pack-destination release-artifact');
    expect(build).toContain('name: npm-package-artifact');
    expect(publish).toContain('name: npm-package-artifact');
    expect(publish).toContain('npm publish "$PACKAGE_TARBALL"');
    expect(publish).toContain('LOCAL_INTEGRITY');
    expect(publish).toContain('REMOTE_INTEGRITY');
  });

  test('publishes retry-safe candidates before promoting any floating channels', () => {
    const workflow = fs.readFileSync(workflowPath, 'utf8');
    const publish = getJobBlock(workflow, 'publish');
    const dockerPublish = getJobBlock(workflow, 'docker-publish');
    const promote = getJobBlock(workflow, 'promote-release');

    expect(publish).toContain('NPM_STAGING_TAG: ${{ needs.release-gate.outputs.npm-staging-tag }}');
    expect(publish).toContain('--tag "$NPM_STAGING_TAG"');
    expect(dockerPublish).toContain('IMAGE_VERSION: ${{ needs.release-gate.outputs.version }}');
    expect(dockerPublish).not.toContain('type=raw,value=latest');
    expect(dockerPublish).not.toContain('pattern={{major}}');
    expect(promote).toContain('needs: [release-gate, publish, docker-publish]');
    expect(promote).toContain('group: neo-n3-mcp-release-promotion');
    expect(promote).toContain('cancel-in-progress: false');
    expect(promote).toContain('Ensure promotion does not move backward');
    expect(promote).toContain('npm dist-tag add');
    expect(promote).toContain('docker buildx imagetools create');
    expect(promote).toContain('docker image inspect --format');
    expect(promote).toContain('org.opencontainers.image.version');
    const dockerPromotionIndex = promote.indexOf('- name: Promote stable Docker aliases');
    const npmPromotionIndex = promote.indexOf('- name: Promote npm channel');
    const cleanupIndex = promote.indexOf('- name: Remove npm candidate tag');

    expect(dockerPromotionIndex).toBeLessThan(npmPromotionIndex);
    expect(npmPromotionIndex).toBeLessThan(cleanupIndex);
  });

  test('captures, publishes, and promotes the immutable container digest', () => {
    const workflow = fs.readFileSync(workflowPath, 'utf8');
    const dockerPublish = getJobBlock(workflow, 'docker-publish');
    const promote = getJobBlock(workflow, 'promote-release');

    expect(dockerPublish).toContain('image-digest: ${{ steps.digest.outputs.digest }}');
    expect(dockerPublish).toContain("docker buildx imagetools inspect --format '{{.Manifest.Digest}}'");
    expect(dockerPublish).toContain('name: container-image-digest');
    expect(promote).toContain('IMAGE_DIGEST: ${{ needs.docker-publish.outputs.image-digest }}');
    expect(promote).toContain('"${IMAGE_REPOSITORY}@${IMAGE_DIGEST}"');
    expect(promote).not.toContain('"${IMAGE_REPOSITORY}:${PACKAGE_VERSION}"\n');
  });

  test.each([
    ['the same version', '2.1.0', '2.1.0'],
    ['a newer stable version', '2.2.0', '2.1.9'],
    ['a newer prerelease', '2.2.0-rc.2', '2.2.0-rc.1'],
    ['a stable version after its prerelease', '2.2.0', '2.2.0-rc.2'],
  ])('allows promotion of %s', (_name, candidate, current) => {
    const workflow = fs.readFileSync(workflowPath, 'utf8');
    const result = runPromotionVersionGuard(workflow, candidate, current);

    expect(result).toMatchObject({ status: 0, stderr: '' });
  });

  test.each([
    ['an older stable version', '2.1.9', '2.2.0'],
    ['an older prerelease', '2.2.0-rc.1', '2.2.0-rc.2'],
    ['a prerelease after the stable version', '2.2.0-rc.2', '2.2.0'],
  ])('rejects promotion of %s', (_name, candidate, current) => {
    const workflow = fs.readFileSync(workflowPath, 'utf8');
    const result = runPromotionVersionGuard(workflow, candidate, current);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(`from ${current} to ${candidate}`);
  });

  test('tests the exact versioned image before pushing it', () => {
    const workflow = fs.readFileSync(workflowPath, 'utf8');
    const dockerPublish = getJobBlock(workflow, 'docker-publish');
    const buildIndex = dockerPublish.indexOf('- name: Build versioned image');
    const healthIndex = dockerPublish.indexOf('- name: Check versioned image health');
    const pushIndex = dockerPublish.indexOf('- name: Push versioned image');

    expect(buildIndex).toBeGreaterThanOrEqual(0);
    expect(healthIndex).toBeGreaterThan(buildIndex);
    expect(pushIndex).toBeGreaterThan(healthIndex);
  });

  test('distinguishes a missing image from a registry failure before retrying publication', () => {
    const workflow = fs.readFileSync(workflowPath, 'utf8');
    const dockerPublish = getJobBlock(workflow, 'docker-publish');

    expect(dockerPublish).toContain(
      'inspect_output="$(docker buildx imagetools inspect "$IMAGE_REF" 2>&1)"'
    );
    expect(dockerPublish).toContain('manifest unknown');
    expect(dockerPublish).toContain('": not found"');
    expect(dockerPublish).toContain('Unable to inspect existing image');
  });

  test('fails closed on npm registry errors while allowing an explicit missing version', () => {
    const workflow = fs.readFileSync(workflowPath, 'utf8');
    const publish = getJobBlock(workflow, 'publish');
    const promote = getJobBlock(workflow, 'promote-release');

    expect(publish).toContain('remote_lookup_status');
    expect(publish).toContain('E404');
    expect(publish).toContain('Unable to query npm for');
    expect(promote).not.toContain('|| true');
  });

  test('pins every third-party action to a full commit SHA', () => {
    const workflow = fs.readFileSync(workflowPath, 'utf8');
    const actionReferences = [...workflow.matchAll(/uses:\s+[^@\s]+@([^\s#]+)/g)].map(
      (match) => match[1]
    );

    expect(actionReferences.length).toBeGreaterThan(0);
    expect(actionReferences.every((reference) => /^[0-9a-f]{40}$/.test(reference))).toBe(true);
  });
});
