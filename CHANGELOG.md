# Changelog

All notable changes to the Neo N3 MCP server will be documented in this file.

## [1.0.3] - 2025-03-18

### Added
- Build and test status badges to README.md
- GitHub Actions workflows:
  - CI workflow for build and test verification
  - Release workflow for npm and Docker publishing
  - Badge update workflow for automatic README updates

### Changed
- Updated example files to better demonstrate network parameter usage
- Improved documentation formatting and clarity
- Added additional resource URL examples

## [1.0.2] - 2025-03-18

### Added
- Dual-network support for both mainnet and testnet
- New `network` parameter for all API endpoints
- Network-specific asset mappings for mainnet and testnet
- Direct network resource URLs (neo://mainnet/... and neo://testnet/...)
- Network testing script (`npm run test:network`)
- Examples script (`npm run example`)
- New documentation:
  - NETWORKS.md explaining the dual-network architecture
  - Updated API.md to include network parameters
  - Updated DEPLOYMENT.md with network configuration options
  - Updated README.md with network examples
  - Updated TESTING.md with network testing information

### Changed
- Updated examples to demonstrate both mainnet and testnet usage
- Modified configuration to support both networks
- Improved error handling for network-related issues

## [1.0.1] - 2025-03-17

### Added
- Simplified JavaScript test runner
- Documentation improvements
- Testing guide

### Fixed
- Package dependencies
- Docker build process
- Configuration options

## [1.0.0] - 2025-03-17

### Added
- Initial release of the Neo N3 MCP server
- Core functionality for Neo N3 blockchain interaction
- MCP protocol integration
- Docker support
- NPM package structure 