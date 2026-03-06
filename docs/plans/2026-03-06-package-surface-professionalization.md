# Package Surface Professionalization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the published `@r3e/neo-n3-mcp` package look like a professional release by trimming internal-only artifacts from the npm tarball and tightening package metadata for consumers.

**Architecture:** Keep runtime behavior unchanged and focus on release-surface polish. Add a packaging regression test that shells out to `npm pack --json --dry-run`, then update `package.json` to publish only the intended runtime assets plus public entry metadata.

**Tech Stack:** TypeScript, Jest, Node.js, npm packaging metadata

### Task 1: Lock the expected npm package surface with a failing test

**Files:**
- Create: `tests/package-surface.test.ts`
- Modify: `package.json`

**Step 1: Write the failing test**
- Add a Jest test that runs `npm pack --json --dry-run` and asserts the tarball includes runtime essentials (`dist/index.js`, `README.md`, `LICENSE`) while excluding internal planning/report files such as `docs/plans/*` and release-process reports.

**Step 2: Run the focused test to verify it fails**
- Run: `npx jest tests/package-surface.test.ts --runInBand`
- Expected: FAIL because the current tarball still includes internal docs and plans.

### Task 2: Tighten published metadata and file selection

**Files:**
- Modify: `package.json`

**Step 1: Publish only the intended files**
- Replace the broad `docs/` file entry with a tight allowlist for runtime assets and curated examples/config files.

**Step 2: Add package-consumer metadata**
- Add `types`, `exports`, `engines`, `repository`, `homepage`, and `bugs` fields aligned with the existing GitHub project URL.

**Step 3: Re-run the focused test**
- Run: `npx jest tests/package-surface.test.ts --runInBand`
- Expected: PASS.

### Task 3: Final verification

**Files:**
- Verify: `package.json`
- Verify: `tests/package-surface.test.ts`

**Step 1: Validate package contents directly**
- Run: `npm pack --json --dry-run`
- Expected: no `docs/plans/*` or internal operational reports in the file list.

**Step 2: Validate project health**
- Run: `npm run type-check && npm test -- --runInBand`
- Expected: PASS for the touched regression test and no type-check regressions.
