import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', () => ({
  appendFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(''),
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('node:child_process', () => ({
  execFile: vi.fn((_cmd: string, _args: string[], _opts: unknown, cb: (err: null, out: string) => void) => {
    cb(null, '');
  }),
}));

const fakeApprovedDraft = JSON.stringify({
  id: 'draft-approved-1',
  scoredItemId: 'scored-1',
  frontmatter: { title: 'Test Article', description: 'Desc', tags: ['gis'], published: false },
  contentMd: '---\ntitle: Test\n---\n\nContent.',
  status: 'pending',
  createdAt: new Date().toISOString(),
});

const fakeApproval = JSON.stringify({
  id: 'approval-1',
  draftId: 'draft-approved-1',
  action: 'approved',
  targets: ['devto'],
  approvedAt: new Date().toISOString(),
});

describe('publish-cli main()', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((_code) => {
      throw new Error(`process.exit(${_code ?? 'undefined'})`);
    });
  });

  afterEach(() => {
    exitSpy.mockRestore();
    delete process.env['DEVTO_API_KEY'];
    vi.clearAllMocks();
  });

  it('calls process.exit(1) when DEVTO_API_KEY is not set', async () => {
    delete process.env['DEVTO_API_KEY'];
    const { main } = await import('../src/publish-cli.js');
    await expect(main()).rejects.toThrow('process.exit(1)');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('does not exit when API key is set and no approved drafts exist', async () => {
    process.env['DEVTO_API_KEY'] = 'test-key';
    const { main } = await import('../src/publish-cli.js');
    await expect(main()).resolves.toBeUndefined();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('processes approved drafts and saves posts when devto API succeeds', async () => {
    process.env['DEVTO_API_KEY'] = 'test-key';

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ url: 'https://dev.to/user/test-article' }), { status: 201 }),
    );

    const { readFile, appendFile } = await import('node:fs/promises');
    const readMock = readFile as ReturnType<typeof vi.fn>;
    readMock
      .mockResolvedValueOnce(fakeApprovedDraft + '\n')
      .mockResolvedValueOnce(fakeApproval + '\n')
      .mockResolvedValueOnce('');

    const { main } = await import('../src/publish-cli.js');
    await main();

    expect(appendFile).toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });
});
