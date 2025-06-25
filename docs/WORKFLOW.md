# GitHub Actions Workflow

This document describes the CI/CD pipeline for the Neo N3 MCP project.

## Overview

The workflow is designed to ensure code quality, security, and reliable deployments. It runs on the latest Ubuntu and includes comprehensive testing, building, and deployment stages.

## Workflow Triggers

- **Push**: Triggers on pushes to `master`, `main`, or `develop` branches
- **Pull Request**: Triggers on PRs to `master` or `main` branches  
- **Release**: Triggers on published releases for deployment

## Jobs

### 1. Test & Lint
- **Runs on**: `ubuntu-latest`
- **Node versions**: 18.x, 20.x, 22.x (matrix strategy)
- **Steps**:
  - Install dependencies
  - Run linting (`npm run lint`)
  - Run type checking (`npm run type-check`)
  - Run tests (`npm test`)
  - Generate coverage report (`npm run test:coverage`)
  - Upload coverage to Codecov

### 2. Build & Validate
- **Runs on**: `ubuntu-latest`
- **Dependencies**: Requires `test` job to pass
- **Steps**:
  - Build project (`npm run build`)
  - Validate build artifacts exist
  - Ensure main entry point is created

### 3. Docker Build & Test
- **Runs on**: `ubuntu-latest`
- **Dependencies**: Requires `test` and `build` jobs to pass
- **Steps**:
  - Build development Docker image
  - Build production Docker image
  - Test both images functionality
  - Validate Docker Compose configurations

### 4. Security Audit
- **Runs on**: `ubuntu-latest`
- **Steps**:
  - Run npm security audit
  - Check dependencies with audit-ci
  - Report outdated packages

### 5. Publish Package (Release only)
- **Runs on**: `ubuntu-latest`
- **Trigger**: Only on release events
- **Dependencies**: All previous jobs must pass
- **Steps**:
  - Build project
  - Publish to NPM registry
  - **Requires**: `NPM_TOKEN` secret

### 6. Publish Docker Images (Release only)
- **Runs on**: `ubuntu-latest`
- **Trigger**: Only on release events
- **Dependencies**: All previous jobs must pass
- **Steps**:
  - Build and push Docker images
  - Tag with version and latest
  - **Requires**: `DOCKER_USERNAME` and `DOCKER_PASSWORD` secrets

### 7. Deploy to Production (Release only)
- **Runs on**: `ubuntu-latest`
- **Trigger**: Only on release events
- **Environment**: `production`
- **Dependencies**: Requires publish jobs to complete
- **Steps**:
  - Deployment notification
  - Custom deployment steps (to be configured)

## Required Secrets

To fully utilize the workflow, configure these secrets in your GitHub repository:

### NPM Publishing
- `NPM_TOKEN`: Token for publishing to NPM registry

### Docker Publishing  
- `DOCKER_USERNAME`: Docker Hub username
- `DOCKER_PASSWORD`: Docker Hub password or access token

## Environment Protection

The `production` environment is protected and requires manual approval for deployments. This ensures that releases are intentionally deployed to production.

## Coverage Reporting

Test coverage is automatically uploaded to Codecov when tests run on Node.js 20.x. This provides visibility into code coverage trends and helps maintain quality standards.

## Matrix Testing

The workflow tests against multiple Node.js versions (18.x, 20.x, 22.x) to ensure compatibility across different runtime environments.

## Docker Multi-Architecture

The Docker build process uses Docker Buildx for advanced build features and caching. Images are optimized for production use with multi-stage builds.

## Workflow Status

You can monitor workflow status through:
- GitHub Actions tab in the repository
- Status badges (can be added to README.md)
- Email notifications (configurable in GitHub settings)

## Customization

To customize the workflow for your specific needs:

1. **Add deployment steps**: Modify the `deploy` job to include your deployment logic
2. **Configure environments**: Set up additional environments in GitHub repository settings
3. **Add more checks**: Include additional security scans, performance tests, etc.
4. **Modify triggers**: Adjust branch names or add additional trigger conditions

## Best Practices

- All jobs run in parallel where possible to minimize CI time
- Dependencies between jobs ensure proper order of operations
- Security audits catch vulnerabilities early
- Multi-stage validation prevents broken releases
- Environment protection ensures controlled deployments

## Troubleshooting

Common issues and solutions:

- **Test failures**: Check test logs and ensure all dependencies are properly installed
- **Build failures**: Verify TypeScript compilation and check for syntax errors
- **Docker failures**: Ensure Dockerfile syntax is correct and base images are available
- **Publishing failures**: Verify secrets are configured and have proper permissions