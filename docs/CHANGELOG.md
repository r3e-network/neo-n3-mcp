# Changelog

All notable changes to the Neo N3 MCP project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.7.3] - 2026-03-10

### 🐛 Fixes
- Updated the Docker build contexts to copy the vendored NeonJS runtime before `npm ci`, so CI release workflows can build and publish from the patched dependency graph.
- Preserved the zero-vulnerability dependency graph while fixing the remaining `v1.7.2` workflow blocker.

## [1.7.2] - 2026-03-10

### 🐛 Fixes
- Added the vendored NeonJS runtime bundle files to source control so CI and npm installs can resolve the local `file:vendor/neon-js` dependency during build and publish workflows.
- Preserved the dependency vulnerability remediation from the previous patch while fixing the broken `v1.7.1` release packaging path.

## [1.7.1] - 2026-03-10

### 🐛 Fixes
- Remediated all GitHub-reported and `npm audit` dependency vulnerabilities in the published dependency graph.
- Vendored the NeonJS runtime bundle to remove the vulnerable published `@cityofzion/neon-js` transitive dependency chain while preserving the existing runtime API used by the server.
- Updated MCP protocol-compliance and stress tests to align with the current SDK error-response semantics after the dependency refresh.

## [1.7.0] - 2026-03-10

### 🚀 New Features
- Added exact-name contract resolution through `https://api.n3index.dev` so contracts can be addressed by local known name, exact remote name, Neo address, or script hash.
- Added a public `get_contract_status` MCP tool and matching HTTP status route for on-chain contract inspection.

### ✨ Enhancements
- Expanded the live MCP stdio surface to 27 tools and aligned the handler, HTTP, and stdio registrations.
- Hardened HTTP contract routes to support encoded contract names such as `Flamingo%20USD`.
- Refreshed the website and docs so active public pages reflect the shipped tool/resource counts and contract interaction flow.

### 🐛 Fixes
- Fixed unsafe fuzzy remote name matches by failing closed on ambiguous or partial contract names.
- Fixed N3Index metadata cache poisoning after transient upstream failures by allowing retry after rejected fetches.
- Fixed contract status handling so RPC/network failures are surfaced instead of being mislabeled as `not_deployed`.
- Fixed unresolved HTTP contract references to return a resource-level `404` response instead of a generic `500`.

## [1.6.4] - 2026-03-06

### ✨ Enhancements
- Hardened the published npm package surface with explicit entry metadata and a tight runtime file allowlist.
- Added a built-artifact MCP smoke test to CI so the compiled `dist/index.js` server is validated after each build.
- Extracted MCP resource registration into `src/handlers/resource-handler.ts` while preserving public resource URIs and payload shapes.

### 🐛 Fixes
- Fixed clean-checkout packaging by rebuilding `dist` during `prepack`, so `npm pack --dry-run` and releases always include compiled output.
- Refreshed release docs and scripts to reflect package-driven server versioning via `src/version.ts` instead of manual `src/index.ts` edits.

## [1.6.0] - 2025-06-25

### 🚀 Major Features Added
- **Enterprise-Grade CI/CD Pipeline**: Complete GitHub Actions workflow with multi-stage testing, building, and deployment
- **Comprehensive Docker Infrastructure**: Production and development Docker environments with multi-stage builds
- **Project Organization**: Restructured project with proper folder hierarchy (docker/, docs/, scripts/)
- **Automated Publishing**: NPM and Docker Hub publishing on releases with proper versioning

### ✨ New Features
- **Multi-Environment Docker Support**: Separate development and production Docker configurations
- **Automated Build Scripts**: Smart Docker build scripts with environment-specific .dockerignore handling
- **Monitoring Stack**: Prometheus and Grafana integration for production deployments
- **Security Auditing**: Automated vulnerability scanning and dependency checks in CI/CD
- **Modern Docker Compose**: Updated to use `docker compose` syntax (Docker Compose V2)

### 🔧 Infrastructure Improvements
- **GitHub Actions Workflow**: 
  - Matrix testing across Node.js 18.x, 20.x, 22.x
  - Multi-stage pipeline: Test → Build → Security → Docker → Publish → Deploy
  - Environment protection for production deployments
  - Automated Docker image building and testing
- **Docker Enhancements**:
  - Multi-stage production builds with security best practices
  - Development images with hot reload and debugging support
  - Optimized .dockerignore files for different build contexts
  - Health checks and proper signal handling with dumb-init
- **Build System**:
  - Automated build scripts with multiple options
  - Environment-specific configuration handling
  - Proper TypeScript compilation in Docker builds

### 📚 Documentation
- **Comprehensive Guides**: 
  - `DOCKER.md` - Complete Docker usage guide (318 lines)
  - `WORKFLOW.md` - CI/CD pipeline documentation (120 lines)
  - `EXAMPLES.md` - Practical usage examples (334 lines)
  - `PRODUCTION_CHECKLIST.md` - Deployment checklist (285 lines)
- **Project Structure**: Clear organization with docs/, docker/, scripts/ folders
- **API Documentation**: Updated with new deployment and usage patterns

### 🛠️ Technical Improvements
- **Test Infrastructure**: 
  - Separated unit tests from integration tests
  - Improved test validation (191 tests passing with robust error handling)
  - Coverage reporting integration with Codecov
- **Build Process**:
  - Fixed TypeScript compilation in Docker builds
  - Proper dependency management for production vs development
  - Optimized build caching and layer management
- **Configuration Management**:
  - Enhanced configuration with rate limiting and logging options
  - Environment-specific Docker configurations
  - Proper secrets management for CI/CD

### 🔒 Security Enhancements
- **Container Security**: Non-root user execution, minimal attack surface
- **Dependency Auditing**: Automated security scanning in CI/CD pipeline
- **Secrets Management**: Proper handling of NPM tokens and Docker credentials
- **Network Security**: Isolated container networking with proper port exposure

### 🐛 Bug Fixes
- **Docker Build Issues**: 
  - Fixed `tsc: not found` error in production builds
  - Resolved tests directory exclusion in development builds
  - Fixed `docker-compose: command not found` in GitHub Actions
- **Test Validation**: Corrected test scenarios to properly validate error conditions
- **Asset Hash Consistency**: Fixed Neo N3 testnet asset hash inconsistencies
- **Version Synchronization**: Aligned server version with package.json

### 📦 Dependencies
- **Updated MCP SDK**: Using @modelcontextprotocol/sdk ^1.9.0
- **Modern Docker**: Support for Docker Compose V2 syntax
- **Node.js Support**: Tested compatibility with Node.js 18.x, 20.x, 22.x
- **Build Tools**: Enhanced TypeScript and Jest configurations

### 🔄 Breaking Changes
- **Docker Compose**: Changed from `docker-compose` to `docker compose` command
- **File Structure**: Moved Docker files to `docker/` folder, documentation to `docs/`
- **Build Scripts**: Updated paths and references due to file reorganization

### 📈 Performance Improvements
- **Docker Builds**: Multi-stage builds reduce final image size
- **CI/CD Pipeline**: Parallel job execution and optimized caching
- **Test Execution**: Separated test types for faster feedback loops

### 🎯 Developer Experience
- **Automated Scripts**: One-command Docker builds and deployments
- **Hot Reload**: Development Docker environment with live code reloading
- **Debugging Support**: Development containers with debugging capabilities
- **Clear Documentation**: Step-by-step guides for all deployment scenarios

---

## [1.5.0] - Previous Release

### Features
- Neo N3 blockchain integration with MCP protocol
- Multi-network support (mainnet/testnet)
- Comprehensive tool and resource implementations
- Robust validation and error handling

### Technical Details
- MCP SDK 1.9.0 integration
- TypeScript implementation with comprehensive testing
- Neo N3 asset management and transaction handling
- Contract interaction capabilities

---

## Version Numbering

This project follows [Semantic Versioning](https://semver.org/):
- **MAJOR** version for incompatible API changes
- **MINOR** version for backwards-compatible functionality additions  
- **PATCH** version for backwards-compatible bug fixes

## Release Process

1. Update version in `package.json` and `package-lock.json`
2. Confirm `src/version.ts` still derives the server version from `package.json`
3. Update this CHANGELOG.md with new features and changes
4. Create a GitHub release with the version tag
5. Automated CI/CD pipeline handles building and publishing
6. Docker images are automatically published to Docker Hub
7. NPM package is automatically published to npm registry

## Contributing

See our contribution guidelines for information on how to contribute to this project and follow our release process.
