import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryDraftRepository } from '../../src/generators/repository.js';
import type { Draft } from '../../src/generators/types.js';

vi.mock('node:fs/promises', () => ({
  appendFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(''),
}));

function makeDraft(status: Draft['status'] = 'pending'): Draft {
  return {
    id: crypto.randomUUID(),
    scoredItemId: crypto.randomUUID(),
    frontmatter: {
      title: 'Test Article',
      description: 'A test article about geospatial',
      tags: ['geospatial', 'japan'],
      published: false,
    },
    contentMd: '---\ntitle: Test Article\n---\n\n# Content\n\nBody text.',
    status,
    createdAt: new Date('2026-05-29T00:00:00Z'),
  };
}

describe('InMemoryDraftRepository', () => {
  it('save() stores a single draft', async () => {
    const repo = new InMemoryDraftRepository();
    const draft = makeDraft();
    await repo.save(draft);
    expect(await repo.findAll()).toHaveLength(1);
  });

  it('saveAll() stores multiple drafts', async () => {
    const repo = new InMemoryDraftRepository();
    await repo.saveAll([makeDraft(), makeDraft()]);
    expect(await repo.findAll()).toHaveLength(2);
  });

  it('findAll() returns a copy (mutation safe)', async () => {
    const repo = new InMemoryDraftRepository();
    await repo.save(makeDraft());
    const first = await repo.findAll();
    first.splice(0);
    expect(await repo.findAll()).toHaveLength(1);
  });

  it('findByStatus() returns only matching drafts', async () => {
    const repo = new InMemoryDraftRepository();
    await repo.saveAll([makeDraft('pending'), makeDraft('approved'), makeDraft('pending')]);
    const pending = await repo.findByStatus('pending');
    expect(pending).toHaveLength(2);
    const approved = await repo.findByStatus('approved');
    expect(approved).toHaveLength(1);
  });
});

describe('JsonlDraftRepository', () => {
  let appendFileMock: ReturnType<typeof vi.fn>;
  let readFileMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const fs = await import('node:fs/promises');
    appendFileMock = fs.appendFile as ReturnType<typeof vi.fn>;
    readFileMock = fs.readFile as ReturnType<typeof vi.fn>;
    appendFileMock.mockClear();
    readFileMock.mockClear();
    appendFileMock.mockResolvedValue(undefined);
    readFileMock.mockResolvedValue('');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('save() appends JSONL line to file', async () => {
    const { JsonlDraftRepository } = await import('../../src/generators/repository.js');
    const repo = new JsonlDraftRepository('/tmp/drafts.jsonl');
    const draft = makeDraft();
    await repo.save(draft);
    expect(appendFileMock).toHaveBeenCalledOnce();
    const written = String(appendFileMock.mock.calls[0]?.[1] ?? '');
    expect(written).toContain(draft.id);
  });

  it('findAll() returns empty when file missing', async () => {
    readFileMock.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
    const { JsonlDraftRepository } = await import('../../src/generators/repository.js');
    const repo = new JsonlDraftRepository('/tmp/nonexistent.jsonl');
    expect(await repo.findAll()).toEqual([]);
  });

  it('findAll() parses JSONL and restores Date', async () => {
    const draft = makeDraft();
    readFileMock.mockResolvedValue(JSON.stringify(draft) + '\n');
    const { JsonlDraftRepository } = await import('../../src/generators/repository.js');
    const repo = new JsonlDraftRepository('/tmp/drafts.jsonl');
    const drafts = await repo.findAll();
    expect(drafts[0].createdAt).toBeInstanceOf(Date);
  });
});
