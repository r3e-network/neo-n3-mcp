# Quick Release Guide

This is the short release checklist for Neo N3 MCP. See [VERSION_MANAGEMENT.md](./VERSION_MANAGEMENT.md) for the full process.

## Prepare a Release

The release script requires Node.js `>=22`, Docker for local image validation, and a clean working tree.

Run a dry run first:

```bash
./scripts/prepare-release.sh --type patch --dry-run
```

Prepare the version after the dry run passes:

```bash
./scripts/prepare-release.sh --type patch
```

Supported types are `patch`, `minor`, and `major`. Use `--skip-docker` only when local image builds are intentionally unavailable; Compose validation still runs.

The script verifies the lockfile, type checking, deterministic unit tests, the build, deterministic MCP tests, dependency audits, package contents, Compose files, and container builds before changing the version. It updates `package.json` and `package-lock.json` without creating a commit or tag.

## Finish the Release

After version preparation:

1. Update `docs/CHANGELOG.md` and version-specific documentation.
2. Review the version and diff.
3. Commit using the repository's Lore commit format.
4. Create and push the matching tag.
5. Publish a GitHub release for that tag.

Example patch release from `2.0.0`:

```bash
git tag v2.0.1
git push origin HEAD
git push origin v2.0.1
gh release create v2.0.1 --generate-notes
```

A pushed tag alone does not publish artifacts. The publish jobs run when the GitHub release is published.

## CI Gates

The current workflow validates:

- deterministic unit tests and type checking on Node.js 22 and 24
- coverage generation on Node.js 22 without a configured minimum threshold or Codecov upload
- a clean build, required `dist/` artifacts, deterministic MCP smoke/lifecycle/registration tests, and an uploaded npm tarball
- full and production-only npm audits
- production and development Compose configuration
- production and development image builds
- production-image liveness using `GET /live`

Live public-RPC checks and stress tests are explicit local commands; they are not part of the default GitHub Actions workflow.

## Publishing

On a published GitHub release, successful validation can publish:

- npm using `NPM_TOKEN`
- Docker images using `DOCKER_USERNAME` and `DOCKER_PASSWORD`

Before either publication, a shared release gate requires the Git tag, after an optional leading `v`, to equal the version in `package.json`. The GitHub prerelease flag must also agree with whether that package version contains a SemVer prerelease suffix. Build metadata (`+...`) and versions that exceed Docker's tag format are rejected.

The build job uploads one validated npm tarball. Publication jobs reuse that tarball and health-test the exact versioned container image before pushing it. Retries accept an existing npm package only when its registry integrity matches the tarball, and accept an existing image only when its revision and version labels match the release.

Versioned candidates publish first. A serialized promotion job runs only after both registries succeed, refuses to move a channel to an older SemVer version, then advances the user-facing aliases. Stable releases use npm `latest` and Docker tags for the full version, major/minor version, major version, and `latest`. Prereleases use npm `next` and only the explicit full prerelease Docker tag, such as `2.1.0-rc.1`; they never update floating stable tags. The workflow does not deploy to a production host, configure a GitHub production environment, notify a deployment system, or perform rollback.

## Post-Release Verification

- Confirm all GitHub Actions jobs completed successfully.
- Verify the npm package version and package contents.
- Verify the expected Docker tags exist.
- Install or pull the published artifact in a clean environment.
- Run the operator-owned deployment smoke checks before routing traffic.

## Troubleshooting

- Preparation rejects the tree: commit or otherwise resolve local changes, then rerun from a clean state.
- Unit/build/MCP failure: reproduce with `npm run verify`.
- Audit failure: inspect both `npm audit --audit-level=high` and `npm audit --omit=dev --audit-level=high`.
- npm publish failure: check the package version, registry state, and `NPM_TOKEN`.
- Docker publish failure: check image-build output and Docker Hub credentials.

## References

- [Version management](./VERSION_MANAGEMENT.md)
- [CI workflow](./WORKFLOW.md)
- [Changelog](./CHANGELOG.md)
