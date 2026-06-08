import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue(''),
  appendFile: vi.fn().mockResolvedValue(undefined),
}));

const fakeKvData = JSON.stringify([
  { shortUrlId: 'url-1', clickedAt: '2026-05-30T10:00:00Z', country: 'JP' },
  { shortUrlId: 'url-2', clickedAt: '2026-05-30T11:00:00Z' },
]);

describe('kv-sync-cli main()', () => {
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

  it('does not exit when kv_clicks.json is not found', async () => {
    const { readFile } = await import('node:fs/promises');
    (readFile as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      Object.assign(new Error('ENOENT'), { code: 'ENOENT' }),
    );

    const { main } = await import('../src/kv-sync-cli.js');
    await expect(main()).resolves.toBeUndefined();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('syncs click entries to clicks.jsonl', async () => {
    const { readFile, appendFile } = await import('node:fs/promises');
    (readFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce(fakeKvData);

    const { main } = await import('../src/kv-sync-cli.js');
    await main();

    expect(appendFile).toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('exits with code 1 on invalid JSON', async () => {
    const { readFile } = await import('node:fs/promises');
    (readFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce('not-json');

    const { main } = await import('../src/kv-sync-cli.js');
    await expect(main()).rejects.toThrow('process.exit(1)');
  });
});
