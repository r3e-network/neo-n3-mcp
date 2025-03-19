# Neo N3 MCP Server 1.1.0 Release Checklist

## Before Release

- [x] Implement the `get_block_count` operation in src/services/neo-service.ts
- [x] Add the tool definition and handler in src/index.ts
- [x] Update documentation to include the new operation
- [x] Update the website with examples and operation reference
- [x] Update the MCP bridge implementation
- [x] Test the new operation locally

## Release Preparation (Completed)

- [x] Update version in package.json to 1.1.0
- [x] Update version in src/index.ts to 1.1.0
- [x] Add CHANGELOG.md entry for 1.1.0
- [x] Create version-1.1.0-summary.md
- [x] Create RELEASE-1.1.0.md with release notes
- [x] Update tag-release.bat script

## Release Steps

1. Make sure all tests pass:
   ```
   npm run test
   npm run test:simple
   npm run test:network
   ```

2. Build the project to ensure all changes compile:
   ```
   npm run build
   ```

3. Run the tag release script to create and push a git tag:
   ```
   .\tag-release.bat
   ```

4. Create a GitHub release:
   - Go to https://github.com/R3E-Network/neo-n3-mcp/releases
   - Click "Draft a new release"
   - Choose the v1.1.0 tag
   - Title: "Neo N3 MCP Server 1.1.0"
   - Copy contents from RELEASE-1.1.0.md into the description
   - Click "Publish release"

5. The GitHub Actions workflow will automatically:
   - Build and test the package
   - Publish to npm with the 1.1.0 tag
   - Build and push Docker images with tags `latest` and `1.1.0`

6. After release, verify:
   - NPM package is published: https://www.npmjs.com/package/@r3e/neo-n3-mcp
   - Docker image is published: https://hub.docker.com/r/r3e/neo-n3-mcp
   - GitHub release page shows the new version

## Post-Release

- Update the website to reflect the new version
- Notify the community about the new release
- Update AI system messages to include the new operation
- Monitor for any issues with the new release 