# Migration Guide: v1.x → v2.0

## Breaking Changes

### 1. neon-js Dependency
**Before:** neon-js was vendored and bundled in the npm package.
**After:** neon-js is a regular npm dependency (`@cityofzion/neon-js@5.x`).

**Action:** No action needed for most users. `npm install` will fetch neon-js automatically.

### 2. Configuration Validation
**Before:** Invalid env vars were silently ignored.
**After:** Server fails fast with descriptive error for invalid values.

**Action:** Check your environment variables:
- `LOG_LEVEL` must be one of: debug, info, warn, error
- `MAX_REQUESTS_PER_MINUTE` must be a number
- RPC URLs must be valid HTTP/HTTPS URLs

### 3. Rate Limiting Enforcement
**Before:** Rate limiter was defined but never called.
**After:** Rate limiting is enforced on all requests.

**Action:** If you need unlimited requests, set `RATE_LIMITING_ENABLED=false` or increase `MAX_REQUESTS_PER_MINUTE`.

### 4. Package Contents
**Before:** npm package included config/docker.json and examples/.
**After:** Only dist/, README.md, and LICENSE are included.

**Action:** If you relied on example files from the package, get them from the GitHub repository instead.
