import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Log Rotation', () => {
  let tmpDir: string;

  beforeEach(() => {
    jest.resetModules();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neo-log-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('rotates log file when it exceeds max size', () => {
    const { rotateLogFile } = require('../src/utils/logger');
    const logPath = path.join(tmpDir, 'test.log');
    fs.writeFileSync(logPath, 'x'.repeat(1024));
    rotateLogFile(logPath, 512, 3);
    expect(fs.existsSync(logPath + '.1')).toBe(true);
  });

  it('cascades rotation (1 to 2, 2 to 3)', () => {
    const { rotateLogFile } = require('../src/utils/logger');
    const logPath = path.join(tmpDir, 'test.log');
    fs.writeFileSync(logPath, 'current');
    fs.writeFileSync(logPath + '.1', 'previous');
    rotateLogFile(logPath, 0, 3);
    expect(fs.readFileSync(logPath + '.2', 'utf-8')).toBe('previous');
    expect(fs.readFileSync(logPath + '.1', 'utf-8')).toBe('current');
  });

  it('deletes oldest file beyond maxFiles', () => {
    const { rotateLogFile } = require('../src/utils/logger');
    const logPath = path.join(tmpDir, 'test.log');
    fs.writeFileSync(logPath, 'current');
    fs.writeFileSync(logPath + '.1', 'one');
    fs.writeFileSync(logPath + '.2', 'two');
    fs.writeFileSync(logPath + '.3', 'three');
    rotateLogFile(logPath, 0, 3);
    expect(fs.existsSync(logPath + '.3')).toBe(true);
    expect(fs.existsSync(logPath + '.4')).toBe(false);
  });
});
