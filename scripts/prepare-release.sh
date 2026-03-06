#!/bin/bash

# Release preparation script for Neo N3 MCP Server
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
VERSION_TYPE="patch"
SKIP_TESTS=false
SKIP_BUILD=false
DRY_RUN=false

# Function to display usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo "Options:"
    echo "  -t, --type TYPE         Version type: patch, minor, major (default: patch)"
    echo "  -s, --skip-tests        Skip running tests"
    echo "  -b, --skip-build        Skip building the project"
    echo "  -d, --dry-run           Show what would be done without making changes"
    echo "  -h, --help              Show this help message"
    exit 1
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--type)
            VERSION_TYPE="$2"
            shift 2
            ;;
        -s|--skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        -b|--skip-build)
            SKIP_BUILD=true
            shift
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo "Unknown option $1"
            usage
            ;;
    esac
done

# Validate version type
if [[ ! "$VERSION_TYPE" =~ ^(patch|minor|major)$ ]]; then
    echo -e "${RED}❌ Invalid version type: $VERSION_TYPE${NC}"
    echo "Valid types: patch, minor, major"
    exit 1
fi

echo -e "${BLUE}🚀 Preparing release for Neo N3 MCP Server${NC}"
echo -e "Version type: ${YELLOW}$VERSION_TYPE${NC}"
echo -e "Skip tests: ${YELLOW}$SKIP_TESTS${NC}"
echo -e "Skip build: ${YELLOW}$SKIP_BUILD${NC}"
echo -e "Dry run: ${YELLOW}$DRY_RUN${NC}"
echo ""

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo -e "Current version: ${YELLOW}$CURRENT_VERSION${NC}"

# Calculate new version (simplified - npm version will do the actual calculation)
echo -e "New version will be calculated by npm version ${YELLOW}$VERSION_TYPE${NC}"
echo ""

if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}🔍 DRY RUN - No changes will be made${NC}"
    echo ""
fi

# Check if working directory is clean
if [ "$DRY_RUN" = false ]; then
    if ! git diff-index --quiet HEAD --; then
        echo -e "${RED}❌ Working directory is not clean. Please commit or stash changes.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Working directory is clean${NC}"
fi

# Run tests
if [ "$SKIP_TESTS" = false ]; then
    echo -e "${BLUE}🧪 Running tests...${NC}"
    if [ "$DRY_RUN" = false ]; then
        npm test
        echo -e "${GREEN}✅ Tests passed${NC}"
    else
        echo -e "${YELLOW}   Would run: npm test${NC}"
    fi
else
    echo -e "${YELLOW}⏭️  Skipping tests${NC}"
fi

# Run type checking
echo -e "${BLUE}🔍 Running type checking...${NC}"
if [ "$DRY_RUN" = false ]; then
    npm run type-check
    echo -e "${GREEN}✅ Type checking passed${NC}"
else
    echo -e "${YELLOW}   Would run: npm run type-check${NC}"
fi

# Build project
if [ "$SKIP_BUILD" = false ]; then
    echo -e "${BLUE}🔨 Building project...${NC}"
    if [ "$DRY_RUN" = false ]; then
        npm run build
        echo -e "${GREEN}✅ Build completed${NC}"
    else
        echo -e "${YELLOW}   Would run: npm run build${NC}"
    fi
else
    echo -e "${YELLOW}⏭️  Skipping build${NC}"
fi

# Update version
echo -e "${BLUE}📝 Updating version...${NC}"
if [ "$DRY_RUN" = false ]; then
    NEW_VERSION=$(npm version $VERSION_TYPE --no-git-tag-version)
    echo -e "${GREEN}✅ Version updated to: $NEW_VERSION${NC}"
    
    echo -e "${GREEN}✅ Runtime version will be read automatically from package.json via src/version.ts${NC}"
else
    echo -e "${YELLOW}   Would run: npm version $VERSION_TYPE --no-git-tag-version${NC}"
    echo -e "${YELLOW}   Runtime version is derived automatically from package.json via src/version.ts${NC}"
fi

# Test Docker builds
echo -e "${BLUE}🐳 Testing Docker builds...${NC}"
if [ "$DRY_RUN" = false ]; then
    echo "   Testing production build..."
    docker build -f docker/Dockerfile -t neo-n3-mcp:test-prod . > /dev/null
    echo "   Testing development build..."
    # Use development .dockerignore temporarily
    cp docker/.dockerignore .dockerignore.temp
    cp .dockerignore .dockerignore.prod
    cp .dockerignore.temp .dockerignore
    docker build -f docker/Dockerfile.dev -t neo-n3-mcp:test-dev . > /dev/null
    # Restore original .dockerignore
    cp .dockerignore.prod .dockerignore
    rm .dockerignore.temp .dockerignore.prod
    echo -e "${GREEN}✅ Docker builds successful${NC}"
else
    echo -e "${YELLOW}   Would test Docker builds${NC}"
fi

# Commit changes
if [ "$DRY_RUN" = false ]; then
    echo -e "${BLUE}📝 Committing changes...${NC}"
    git add package.json package-lock.json
    git commit -m "chore: bump version to $NEW_VERSION

Prepared for release with:
- Updated package.json version
- Runtime server version remains package-driven via src/version.ts
- Verified tests, type checking, and builds
- Confirmed Docker builds working"
    echo -e "${GREEN}✅ Changes committed${NC}"
else
    echo -e "${YELLOW}   Would commit version changes${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Release preparation completed!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo -e "1. Review the changes: ${YELLOW}git log -1${NC}"
echo -e "2. Push to repository: ${YELLOW}git push${NC}"
echo -e "3. Create GitHub release: ${YELLOW}gh release create $NEW_VERSION${NC}"
echo -e "4. CI/CD will automatically build and publish"
echo ""
echo -e "${BLUE}Or to create a release immediately:${NC}"
echo -e "${YELLOW}git push && gh release create $NEW_VERSION --generate-notes${NC}"