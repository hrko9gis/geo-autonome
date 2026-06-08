import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  appendFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(''),
}));

describe('report-cli main()', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((_code) => {
      throw new Error(`process.exit(${_code ?? 'undefined'})`);
    });
  });

  afterEach(() => {
    exitSpy.mockRestore();
    vi.clearAllMocks();
  });

  it('completes without calling process.exit on empty data', async () => {
    const { main } = await import('../src/report-cli.js');
    await expect(main()).resolves.toBeUndefined();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('writes report JSON and weights file', async () => {
    const { writeFile } = await import('node:fs/promises');
    const writeSpy = writeFile as ReturnType<typeof vi.fn>;

    const { main } = await import('../src/report-cli.js');
    await main();

    expect(writeSpy).toHaveBeenCalledTimes(2); // report + weights
  });
});
