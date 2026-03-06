import fs from 'fs';
import path from 'path';

describe('CI workflow', () => {
  test('runs the built MCP smoke test after the build step', () => {
    const workflowPath = path.join(__dirname, '..', '.github', 'workflows', 'ci.yml');
    const workflow = fs.readFileSync(workflowPath, 'utf8');

    const buildStepIndex = workflow.indexOf('- name: Build project');
    const smokeStepIndex = workflow.indexOf('- name: Run built MCP smoke test');
    const smokeCommandIndex = workflow.indexOf('run: npm run test:mcp:smoke');

    expect(buildStepIndex).toBeGreaterThanOrEqual(0);
    expect(smokeStepIndex).toBeGreaterThan(buildStepIndex);
    expect(smokeCommandIndex).toBeGreaterThan(smokeStepIndex);
  });
});
