import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryPostRepository } from '../../src/publisher/repository.js';
import type { Post } from '../../src/publisher/types.js';

vi.mock('node:fs/promises', () => ({
  appendFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(''),
}));

function makePost(draftId = 'draft-1', platform: Post['platform'] = 'devto'): Post {
  return {
    id: crypto.randomUUID(),
    draftId,
    platform,
    externalUrl: 'https://dev.to/user/article',
    publishedAt: new Date('2026-05-29T10:00:00Z'),
  };
}

describe('InMemoryPostRepository', () => {
  it('save() stores a post', async () => {
    const repo = new InMemoryPostRepository();
    await repo.save(makePost());
    expect(await repo.findAll()).toHaveLength(1);
  });

  it('findAll() returns a copy (mutation safe)', async () => {
    const repo = new InMemoryPostRepository();
    await repo.save(makePost());
    const first = await repo.findAll();
    first.splice(0);
    expect(await repo.findAll()).toHaveLength(1);
  });

  it('findByDraftId() returns only matching posts', async () => {
    const repo = new InMemoryPostRepository();
    await repo.save(makePost('draft-A', 'devto'));
    await repo.save(makePost('draft-B', 'blog'));
    const result = await repo.findByDraftId('draft-A');
    expect(result).toHaveLength(1);
    expect(result[0].draftId).toBe('draft-A');
  });
});

describe('JsonlPostRepository', () => {
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

  afterEach(() => vi.clearAllMocks());

  it('save() appends JSONL line', async () => {
    const { JsonlPostRepository } = await import('../../src/publisher/repository.js');
    const repo = new JsonlPostRepository('/tmp/posts.jsonl');
    const post = makePost();
    await repo.save(post);
    expect(appendFileMock).toHaveBeenCalledOnce();
    const written = String(appendFileMock.mock.calls[0]?.[1] ?? '');
    expect(written).toContain(post.id);
  });

  it('findAll() returns empty when file not found', async () => {
    readFileMock.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
    const { JsonlPostRepository } = await import('../../src/publisher/repository.js');
    const repo = new JsonlPostRepository('/tmp/nonexistent.jsonl');
    expect(await repo.findAll()).toEqual([]);
  });

  it('findAll() parses JSONL and restores Date', async () => {
    const post = makePost();
    readFileMock.mockResolvedValue(JSON.stringify(post) + '\n');
    const { JsonlPostRepository } = await import('../../src/publisher/repository.js');
    const repo = new JsonlPostRepository('/tmp/posts.jsonl');
    const posts = await repo.findAll();
    expect(posts[0].publishedAt).toBeInstanceOf(Date);
  });
});
