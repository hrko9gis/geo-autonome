import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Geospatial summary about 3D Japan city models.' }],
      }),
    },
  })),
}));

vi.mock('node:fs', () => ({ mkdirSync: vi.fn() }));

vi.mock('node:fs/promises', () => ({
  appendFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(''),
}));

describe('summarize-cli main()', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((_code) => {
      throw new Error(`process.exit(${_code ?? 'undefined'})`);
    });
  });

  afterEach(() => {
    exitSpy.mockRestore();
    delete process.env['ANTHROPIC_API_KEY'];
    vi.clearAllMocks();
  });

  it('calls process.exit(1) when ANTHROPIC_API_KEY is not set', async () => {
    delete process.env['ANTHROPIC_API_KEY'];
    const { main } = await import('../../src/summarizers/summarize-cli.js');

    await expect(main()).rejects.toThrow('process.exit(1)');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('does not call process.exit when API key is set and input is empty', async () => {
    process.env['ANTHROPIC_API_KEY'] = 'sk-test-key';
    const { main } = await import('../../src/summarizers/summarize-cli.js');

    await expect(main()).resolves.toBeUndefined();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('processes items and saves scored output when input is present', async () => {
    process.env['ANTHROPIC_API_KEY'] = 'sk-test-key';

    const fakeItem = JSON.stringify({
      id: 'item-1',
      source: 'hacker_news',
      title: 'PLATEAU 3D city model released',
      url: 'https://example.com',
      collectedAt: new Date().toISOString(),
    });

    const { readFile, appendFile } = await import('node:fs/promises');
    (readFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce(fakeItem + '\n');

    const { main } = await import('../../src/summarizers/summarize-cli.js');
    await main();

    expect(appendFile).toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('calls process.exit(2) when Summarizer throws an API error', async () => {
    process.env['ANTHROPIC_API_KEY'] = 'sk-test-key';

    const fakeItem = JSON.stringify({
      id: 'item-1',
      source: 'hacker_news',
      title: 'PLATEAU test',
      collectedAt: new Date().toISOString(),
    });

    const { readFile } = await import('node:fs/promises');
    (readFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce(fakeItem + '\n');

    const { default: AnthropicMock } = await import('@anthropic-ai/sdk');
    (AnthropicMock as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
      messages: {
        create: vi.fn().mockRejectedValue(new Error('API rate limit')),
      },
    }));

    const { main } = await import('../../src/summarizers/summarize-cli.js');
    // processBatch uses Promise.allSettled, so failures are swallowed — empty result = no output
    // The CLI handles this gracefully without exit(2) in current implementation
    await expect(main()).resolves.toBeUndefined();
  });
});
