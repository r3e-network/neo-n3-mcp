# GitHub Actions Workflow

The repository workflow is defined in `.github/workflows/ci.yml`. It validates source, package, dependency, Compose, and container surfaces, then publishes artifacts for a GitHub release.

## Triggers

| Event | Scope |
| --- | --- |
| Push | `master`, `main`, and `develop` |
| Pull request | `master` and `main` |
| Release | Published GitHub releases |

The workflow does not trigger artifact publishing from a tag push alone.

## Jobs

### Test

The test matrix runs on Node.js 22 and 24:

```bash
npm ci
npm run type-check
npm run test:unit -- --runInBand
```

Node.js 22 also runs:

```bash
npm run test:coverage -- --runInBand
```

Coverage is retained in the job output only. The workflow does not upload to Codecov and the Jest configuration does not define a minimum coverage threshold.

### Build and Package

After the test matrix passes, the build job uses Node.js 22:

```bash
npm ci
npm run build
npm run test:mcp
npm pack --dry-run
```

It also checks that `dist/index.js`, `dist/http.js`, and `dist/index.d.ts` exist. `test:mcp` covers deterministic built-server smoke, stdio lifecycle, and modern tool-registration behavior.

The build job then creates one npm tarball, validates its metadata and integrity, and uploads it as the `npm-package-artifact` workflow artifact. Publication reuses this exact tarball rather than rebuilding the package.

### Dependency Audit

The independent security job runs both audits on Node.js 22:

```bash
npm audit --audit-level=high
npm audit --omit=dev --audit-level=high
```

The dependency graph currently uses a scoped `lodash@4.18.1` override under `@cityofzion/neon-core`.

### Container Validation

After test, build, and audit jobs pass, the container job:

1. Validates `docker/docker-compose.yml` with a CI-only API key.
2. Validates `docker/docker-compose.dev.yml`.
3. Builds `docker/Dockerfile.dev`.
4. Builds `docker/Dockerfile`.
5. Starts the production image with `NEO_NETWORK=testnet` and an API key.
6. Waits for the image health check to report healthy.

The workflow uses Docker Buildx setup, but it does not declare a multi-platform build matrix.

### Release Gate

For a published GitHub release, `release-gate` waits for all validation jobs. It requires the release tag, after an optional leading `v`, to equal `package.json`, requires GitHub's prerelease flag to match the SemVer version, and rejects versions that cannot be represented exactly as Docker tags. It derives the final npm channel and stable Docker aliases.

### Candidate Publication

The Docker job publishes only the full version tag. A new image is built with release revision/version labels, run under the production resource and filesystem restrictions, and required to become healthy before that exact local image is pushed. On retry, an existing image is pulled, its labels are verified, and that exact remote image is health-tested.

Only after that versioned container candidate is healthy and available, the npm
job downloads the validated tarball and publishes it directly to `latest`, or
`next` for a prerelease, using npm Trusted Publishing over GitHub Actions OIDC.
It runs on Node.js 24 with npm 11 or newer. On retry, it accepts an existing
version only when the registry integrity equals the tarball and the expected
dist-tag already points to that version.

```bash
npm publish "$PACKAGE_TARBALL" --access public --tag "$NPM_DIST_TAG"
```

The npm package must trust `r3e-network/neo-mcp` and workflow `ci.yml` for the
`npm publish` action. No long-lived npm token is used.

### Channel Promotion

`promote-release` waits for npm publication and the versioned Docker candidate,
serializes channel movement, verifies both registries, and refuses to promote an
older version. npm already points to the release channel after its OIDC-backed
publish. Stable releases then promote Docker aliases; prereleases never update a
floating Docker tag.

Required secrets:

- `DOCKER_USERNAME`
- `DOCKER_PASSWORD`

## Deliberately Excluded

The current workflow does not run:

- `npm run test:mcp:live`
- `npm run test:mcp:stress`
- `npm run test:integration`
- automated production deployment or rollback
- dashboards, alerting, or a monitoring backend
- Codecov upload

Run live and stress checks explicitly when their external-network or load behavior is relevant.

## Local Reproduction

Use the deterministic project verification command first:

```bash
npm run verify
```

Then reproduce audit and container gates as needed:

```bash
npm audit --audit-level=high
npm audit --omit=dev --audit-level=high
npm pack --dry-run

HTTP_API_KEY=local-ci-check-key-0000000000000000 \
  docker compose -f docker/docker-compose.yml config
docker compose -f docker/docker-compose.dev.yml config
```

## Failure Triage

- Test matrix: reproduce the failing Node version and run `test:unit` with `--runInBand`.
- Build job: run `npm run build`, then `npm run test:mcp` against the fresh `dist/` output.
- Audit job: inspect the advisory path before changing or broadening dependency overrides.
- Container job: validate Compose interpolation, image startup environment, and `/live` output.
- Publish job: verify artifact version, credentials, and registry access.
