# Version Management Guide

This document outlines the version management strategy and release process for the Neo N3 MCP project.

## Version Strategy

The project follows [Semantic Versioning (SemVer)](https://semver.org/) with the format `MAJOR.MINOR.PATCH`:

- **MAJOR** (X.0.0): Breaking changes that are not backwards compatible
- **MINOR** (0.X.0): New features that are backwards compatible
- **PATCH** (0.0.X): Bug fixes that are backwards compatible

### Current Version: 1.6.0

## Version Management Scripts

### Quick Version Commands

```bash
# Check current version
npm run version:check

# Bump patch version (1.6.0 → 1.6.1)
npm run version:patch

# Bump minor version (1.6.0 → 1.7.0)
npm run version:minor

# Bump major version (1.6.0 → 2.0.0)
npm run version:major

# Prepare for release (build, test, type-check)
npm run release:prepare
```

### Automated Release Script

Use the comprehensive release preparation script:

```bash
# Prepare patch release (recommended for bug fixes)
./scripts/prepare-release.sh --type patch

# Prepare minor release (recommended for new features)
./scripts/prepare-release.sh --type minor

# Prepare major release (for breaking changes)
./scripts/prepare-release.sh --type major

# Dry run to see what would happen
./scripts/prepare-release.sh --type minor --dry-run

# Skip tests and build (not recommended)
./scripts/prepare-release.sh --type patch --skip-tests --skip-build
```

## Release Process

### 1. Preparation Phase

1. **Ensure Clean State**:
   ```bash
   git status  # Should be clean
   git pull origin master  # Get latest changes
   ```

2. **Run Pre-Release Checks**:
   ```bash
   npm run release:prepare  # Builds, tests, and type-checks
   ```

3. **Update Documentation**:
   - Update `docs/CHANGELOG.md` with new features and changes
   - Review and update `README.md` if needed
   - Update any relevant documentation

### 2. Version Update Phase

1. **Use Automated Script** (Recommended):
   ```bash
   ./scripts/prepare-release.sh --type minor
   ```

2. **Manual Process** (Alternative):
   ```bash
   # Update package.json version
   npm version minor --no-git-tag-version
   
   # Update version in src/index.ts manually
   # Update CHANGELOG.md
   
   # Commit changes
   git add .
   git commit -m "chore: bump version to 1.7.0"
   ```

### 3. Release Phase

1. **Push Changes**:
   ```bash
   git push origin master
   ```

2. **Create GitHub Release**:
   ```bash
   # Using GitHub CLI (recommended)
   gh release create v1.7.0 --generate-notes
   
   # Or manually through GitHub web interface
   ```

3. **Automated CI/CD**:
   - GitHub Actions automatically triggers on release
   - Builds and tests the project
   - Publishes to NPM registry
   - Publishes Docker images to Docker Hub
   - Deploys to production (if configured)

## Version Locations

When updating versions, ensure consistency across these files:

1. **`package.json`**: Main version source
   ```json
   {
     "version": "1.6.0"
   }
   ```

2. **`src/index.ts`**: Server version
   ```typescript
   this.server = new McpServer({
     name: 'neo-n3-mcp-server',
     version: '1.6.0',
   });
   ```

3. **`docs/CHANGELOG.md`**: Version history
   ```markdown
   ## [1.6.0] - 2025-06-25
   ```

## Release Types and Examples

### Patch Release (1.6.0 → 1.6.1)
**When to use**: Bug fixes, security patches, minor improvements

**Examples**:
- Fix Docker build issues
- Correct validation logic
- Update dependencies for security
- Fix typos in documentation

**Command**:
```bash
./scripts/prepare-release.sh --type patch
```

### Minor Release (1.6.0 → 1.7.0)
**When to use**: New features, enhancements, non-breaking changes

**Examples**:
- Add new MCP tools or resources
- Enhance existing functionality
- Add new configuration options
- Improve performance
- Add new documentation

**Command**:
```bash
./scripts/prepare-release.sh --type minor
```

### Major Release (1.6.0 → 2.0.0)
**When to use**: Breaking changes, major architecture changes

**Examples**:
- Change API interfaces
- Remove deprecated features
- Major dependency updates
- Significant architecture changes
- Change configuration format

**Command**:
```bash
./scripts/prepare-release.sh --type major
```

## Automated CI/CD Pipeline

The release process triggers automated workflows:

### On Version Tag/Release:
1. **Build & Test**: Multi-version Node.js testing
2. **Security Audit**: Dependency vulnerability scanning
3. **Docker Build**: Both development and production images
4. **NPM Publish**: Automatic package publishing
5. **Docker Publish**: Multi-tag image publishing
6. **Production Deploy**: Automated deployment (if configured)

### Required Secrets:
- `NPM_TOKEN`: For NPM registry publishing
- `DOCKER_USERNAME`: Docker Hub username
- `DOCKER_PASSWORD`: Docker Hub access token

## Version History

| Version | Date | Type | Description |
|---------|------|------|-------------|
| 1.6.0 | 2025-06-25 | Minor | Enterprise CI/CD, Docker infrastructure, project organization |
| 1.5.0 | Previous | Minor | Neo N3 MCP integration, multi-network support |

## Best Practices

### Before Releasing:
- [ ] All tests pass
- [ ] Documentation is updated
- [ ] CHANGELOG.md is updated
- [ ] Breaking changes are documented
- [ ] Version numbers are consistent

### During Release:
- [ ] Use semantic versioning correctly
- [ ] Write clear release notes
- [ ] Test the release process in staging
- [ ] Monitor deployment

### After Release:
- [ ] Verify NPM package is published
- [ ] Verify Docker images are available
- [ ] Test installation from published sources
- [ ] Monitor for issues

## Troubleshooting

### Common Issues:

1. **Version Mismatch**:
   ```bash
   # Check all version locations
   grep -r "1\.6\.0" package.json src/index.ts docs/CHANGELOG.md
   ```

2. **Failed NPM Publish**:
   - Check NPM_TOKEN secret
   - Verify package name availability
   - Check npm registry status

3. **Failed Docker Publish**:
   - Check DOCKER_USERNAME and DOCKER_PASSWORD secrets
   - Verify Docker Hub repository exists
   - Check Docker build logs

4. **CI/CD Pipeline Failures**:
   - Check GitHub Actions logs
   - Verify all required secrets are set
   - Check test failures

### Recovery:

If a release fails:
1. Fix the underlying issue
2. Increment patch version
3. Re-run release process
4. Update release notes to mention the fix

## Future Enhancements

Planned improvements to version management:
- Automated changelog generation
- Release candidate (RC) versions
- Hotfix branch strategy
- Automated rollback capabilities
- Integration with project management tools