# Quick Release Guide

This is a quick reference for triggering releases in the Neo N3 MCP project.

## 🚀 Quick Commands

### For New Features (Minor Release)
```bash
# Recommended approach
./scripts/prepare-release.sh --type minor
git push
gh release create v1.7.0 --generate-notes
```

### For Bug Fixes (Patch Release)
```bash
./scripts/prepare-release.sh --type patch
git push
gh release create v1.6.1 --generate-notes
```

### For Breaking Changes (Major Release)
```bash
./scripts/prepare-release.sh --type major
git push
gh release create v2.0.0 --generate-notes
```

## 🔍 Pre-Release Checklist

- [ ] All tests are passing locally
- [ ] Documentation is updated
- [ ] CHANGELOG.md is current
- [ ] No uncommitted changes
- [ ] On master/main branch

## 🎯 What Gets Triggered

When you create a GitHub release, the following happens automatically:

1. **Testing Pipeline** (5-10 minutes)
   - Multi-version Node.js testing (18.x, 20.x, 22.x)
   - Linting and type checking
   - Unit tests with coverage

2. **Build Pipeline** (3-5 minutes)
   - TypeScript compilation
   - Docker image builds (dev + production)
   - Container testing

3. **Security Pipeline** (2-3 minutes)
   - npm security audit
   - Dependency vulnerability check
   - Package update analysis

4. **Publishing Pipeline** (5-10 minutes)
   - NPM package publishing
   - Docker Hub image publishing
   - Multi-tag versioning

5. **Deployment Pipeline** (1-2 minutes)
   - Production deployment notification
   - Release tracking

**Total Time: ~15-30 minutes for complete pipeline**

## 🔧 Manual Alternative

If you prefer manual control:

```bash
# 1. Update version
npm version minor  # or patch/major

# 2. Update src/index.ts version manually
# 3. Update CHANGELOG.md
# 4. Commit changes
git add .
git commit -m "chore: bump version to 1.7.0"

# 5. Push and create release
git push
gh release create v1.7.0 --generate-notes
```

## 🐛 Troubleshooting

### Pipeline Fails
- Check GitHub Actions logs
- Verify all secrets are configured
- Ensure tests pass locally first

### NPM Publish Fails
- Check NPM_TOKEN secret
- Verify package name availability
- Check npm registry status

### Docker Publish Fails
- Check DOCKER_USERNAME/DOCKER_PASSWORD secrets
- Verify Docker Hub repository exists
- Check Docker build logs

## 📊 Monitoring

After release:
- Monitor GitHub Actions for completion
- Check NPM package: https://www.npmjs.com/package/@r3e/neo-n3-mcp
- Check Docker images: https://hub.docker.com/r/r3e/neo-n3-mcp
- Verify version tags in repository

## 🔗 Links

- [Full Version Management Guide](./VERSION_MANAGEMENT.md)
- [CI/CD Workflow Documentation](./WORKFLOW.md)
- [Complete Changelog](./CHANGELOG.md)