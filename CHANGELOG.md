# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.0] - 2025-01-25

### Added
- Comprehensive unit test suite with 395 tests covering all functionality
- Production readiness report with detailed security and performance analysis
- Enhanced input validation with XSS prevention and strict type checking
- Complete test coverage for all 34 MCP tools and 9 resources
- Security validation tests proving attack prevention mechanisms

### Improved
- Validation functions now properly handle edge cases and security threats
- Error handling provides clear, actionable feedback without information disclosure
- Test execution performance optimized to under 5 seconds for full suite
- Code organization with clean separation of concerns

### Fixed
- HTML sanitization now properly removes script tags and content
- Boolean validation strictly enforces format requirements
- Address validation uses proper Neo N3 checksum verification
- All linting errors resolved

### Removed
- Temporary development files and debug scripts
- Intermediate test files and analysis documents
- Unused Docker configurations and test runners
- Development artifacts and build intermediates

### Security
- Comprehensive input validation prevents injection attacks
- XSS protection through proper string sanitization
- Strict WIF and private key validation
- Confirmation requirements for all sensitive operations

## [1.4.0] - 2025-01-24

### Added
- Enhanced MCP protocol compliance with latest SDK features
- Comprehensive blockchain operation support
- Advanced contract interaction capabilities
- Multi-network support (mainnet/testnet)
- Resource-based blockchain data access

### Improved
- Error handling and user feedback
- Performance optimizations
- Documentation completeness
- Test coverage expansion

### Fixed
- MCP protocol compatibility issues
- Resource response format compliance
- Tool parameter validation
- Network switching reliability

## [1.3.0] - 2024-12-15

### Added
- Famous contracts integration (NeoFS, NeoBurger, Flamingo, etc.)
- Contract operation discovery and validation
- Enhanced wallet management with encryption
- GAS claiming functionality

### Improved
- Contract interaction reliability
- Wallet security measures
- Operation confirmation workflows
- Error message clarity

## [1.2.0] - 2024-11-20

### Added
- HTTP API server alongside MCP server
- RESTful endpoints for blockchain operations
- Swagger/OpenAPI documentation
- Docker containerization support

### Improved
- API response consistency
- Error handling standardization
- Performance monitoring
- Deployment flexibility

## [1.1.0] - 2024-10-15

### Added
- Asset transfer capabilities
- Balance checking for NEP-17 tokens
- Transaction fee estimation
- Block and transaction querying

### Improved
- Network connectivity handling
- RPC client reliability
- Response data formatting
- User experience

## [1.0.0] - 2024-09-01

### Added
- Initial MCP server implementation
- Basic Neo N3 blockchain integration
- Wallet creation and management
- Network mode switching (mainnet/testnet)
- Core blockchain information retrieval

### Features
- 34 MCP tools for blockchain operations
- 9 MCP resources for data access
- Comprehensive input validation
- Error handling and logging
- TypeScript implementation with full type safety