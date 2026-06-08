import { describe, expect, it, vi } from 'vitest';
import { ChildProcessUnityValidator } from '../../src/pipeline/unity-validator.js';
import type { IChildProcessExecutor } from '../../src/pipeline/executor.js';

function makeExecutor(exitCode: number): IChildProcessExecutor {
  return { exec: vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode }) };
}

describe('ChildProcessUnityValidator', () => {
  it('returns true when Unity exits with code 0', async () => {
    const validator = new ChildProcessUnityValidator(makeExecutor(0), 'unity');
    expect(await validator.validate('/assets/osaka.fbx')).toBe(true);
  });

  it('returns false when Unity exits with non-zero code', async () => {
    const validator = new ChildProcessUnityValidator(makeExecutor(1), 'unity');
    expect(await validator.validate('/assets/osaka.fbx')).toBe(false);
  });

  it('calls unity with -batchmode -nographics -quit flags', async () => {
    const executor = makeExecutor(0);
    const validator = new ChildProcessUnityValidator(executor, 'unity');
    await validator.validate('/assets/osaka.fbx');

    const [, args] = (executor.exec as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(args).toContain('-batchmode');
    expect(args).toContain('-nographics');
    expect(args).toContain('-quit');
    expect(args).toContain('/assets/osaka.fbx');
  });
});
