# Changelog

All notable changes to the Neo N3 MCP server will be documented in this file.

## [1.1.0] - 2025-03-25

### Added
- New `get_block_count` operation to retrieve the current block height
- API documentation for the `get_block_count` operation
- Comprehensive test coverage for `get_block_count`
- Expanded website documentation with MCP operations reference section

### Changed
- Enhanced error handling for RPC method calls
- Improved MCP operation response formats for consistency
- Updated AI integration examples with new operation
- Enhanced chat examples to demonstrate proper operation usage

### Fixed
- Resolved "is not a function" errors in MCP bridge implementation
- Improved error messages when operations are not found
- Added proper network connectivity checks before RPC calls
- Fixed documentation and implementation mismatches

## [1.0.8] - 2025-03-23

### Added
- Comprehensive website with detailed documentation, user guides, and integration examples
- Rebuild script for website assets with automatic SVG generation
- Dark mode support in website UI

### Changed
- Updated RPC URLs to use reliable HTTPS endpoints:
  - Mainnet: https://mainnet1.neo.coz.io:443
  - Testnet: https://testnet1.neo.coz.io:443
- Enhanced website design with modern UI elements and animations
- Improved documentation organization and readability
- Enhanced scripts for local development and testing

### Fixed
- Fixed SVG image rendering issues in documentation
- Corrected environment variable naming in examples
- Standardized configuration examples across documentation

## [1.0.7] - 2025-03-22

### Added
- Comprehensive test suite for transaction status and fee estimation
- Mock implementations for blockchain RPC responses in tests
- Support for testing confirmed, pending, and not-found transaction states

### Changed
- Improved test reliability with isolated mock functions
- Enhanced test structure with clear error reporting
- Optimized testing approach for better cross-platform compatibility

### Fixed
- Mock data generation for transaction tests
- Windows PowerShell compatibility in test commands
- Test stability with proper cleanup of mock implementations

## [1.0.6] - 2025-03-20

### Added
- New `estimate_transfer_fees` tool to calculate gas costs for transactions
- New `check_transaction_status` tool with detailed transaction state tracking
- Retry mechanism for RPC calls with exponential backoff
- Enhanced transaction status reporting with additional details
- New transaction status and fee estimation tests with comprehensive mocking
- Added test coverage for confirmed, pending, and not-found transaction states

### Changed
- Improved validation for transaction hash formats
- Enhanced error messages for transaction status checks
- Optimized RPC client interaction with retry logic
- Extended status reporting for transactions with block details
- Enhanced fee estimation with buffer calculation for gas costs

### Fixed
- Transaction status edge cases for pending transactions
- Error handling in fee estimation logic
- Validation for address formats in fee estimation
- Improved transaction test mocking for consistent results

## [1.0.5] - 2025-03-19

### Changed
- Enhanced error handling throughout the codebase with detailed error messages
- Improved input validation in all service methods
- Added constructor validation for RPC URL and network parameters
- Implemented proper transaction signing in asset transfer and contract invocation
- Improved asset hash resolution with better error messaging
- Standardized all RPC calls to use direct execute method for maximum compatibility
- Added comprehensive address validation in transfer and contract invocation methods

### Fixed
- Removed all test-specific logic from production code paths
- Implemented proper error propagation instead of swallowing exceptions
- Fixed transaction signing implementation for better reliability
- Improved error handling with specific error messages
- Fixed compatibility issues with different versions of neon-js
- Resolved "is not a function" errors by using consistent RPC method calls
- Fixed "invalid base58 character" errors in wallet address handling
- Enhanced transaction signing with multiple fallback strategies

## [1.0.4] - 2025-03-18

### Added
- New test case for network selection functionality
- Comprehensive test coverage for dual-network implementation

### Changed
- Improved TypeScript typing in tests
- Better error handling in Jest test mocks
- Enhanced test structure for better maintainability

### Fixed
- Resolved remaining TypeScript type errors in tests
- Fixed utility typing helper for Jest mock functions
- Fixed compatibility issues with neon-js RPC client methods (getTransaction, getBalance, etc.)
- Added fallback mechanisms for RPC method calls for better cross-version compatibility
- Improved wallet methods with robust error handling and test fallbacks
- Enhanced all Neo service methods with consistent error handling patterns

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
- Updated dependency from @r3e/sdk to @modelcontextprotocol/sdk

### Fixed
- GitHub Actions workflows to handle missing lock files
- Added conditional steps for npm installation in CI/CD pipelines
- Made test steps more resilient in CI pipelines
- Fixed dependency specifications for better compatibility
- Fixed postinstall script to be cross-platform compatible
- Updated Jest configuration for compatibility with ES modules
- Fixed TypeScript type errors in Jest tests

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