import fs from 'fs';
import path from 'path';

describe('documentation surface', () => {
  const repoRoot = path.resolve(__dirname, '..');

  test('website API docs describe the generic contract flow', () => {
    const websiteApiDoc = fs.readFileSync(path.join(repoRoot, 'website/docs/api.html'), 'utf8');

    expect(websiteApiDoc).toContain('get_contract_status');
    expect(websiteApiDoc).toContain('"name": "invoke_contract"');
    expect(websiteApiDoc).toContain('known name, script hash, or Neo address');
    expect(websiteApiDoc).not.toContain('invoke_read_contract');
    expect(websiteApiDoc).not.toContain('invoke_write_contract');
    expect(websiteApiDoc).not.toContain('#blockchain-resources');
    expect(websiteApiDoc).not.toContain('#contract-resources');
  });

  test('user-facing website pages do not advertise stale tool or resource counts', () => {
    const pages = [
      'website/index.html',
      'website/docs/getting-started.html',
      'website/docs/index.html',
      'website/404.html',
      'website/docs/testing.html',
    ];

    for (const relativePath of pages) {
      const content = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
      expect(content).not.toContain('34 tools');
      expect(content).not.toContain('34+ tools');
      expect(content).not.toContain('9 resources');
    }
  });
});
