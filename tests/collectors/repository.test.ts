import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryItemRepository } from '../../src/collectors/repository.js';
import type { RawItem } from '../../src/collectors/types.js';

vi.mock('node:fs/promises', () => ({
  appendFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(''),
}));

function makeItem(source: RawItem['source'] = 'hacker_news'): RawItem {
  return {
    id: crypto.randomUUID(),
    source,
    title: `Test item from ${source}`,
    url: 'https://example.com',
    collectedAt: new Date('2026-05-28T00:00:00Z'),
  };
}

describe('InMemoryItemRepository', () => {
  it('save() stores a single item retrievable via findAll()', async () => {
    const repo = new InMemoryItemRepository();
    const item = makeItem();

    await repo.save(item);
    const all = await repo.findAll();

    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(item.id);
  });

  it('findBySource() returns only items matching the source', async () => {
    const repo = new InMemoryItemRepository();
    const hnItem = makeItem('hacker_news');
    const redditItem = makeItem('reddit');
    await repo.saveAll([hnItem, redditItem]);

    const hnItems = await repo.findBySource('hacker_news');

    expect(hnItems).toHaveLength(1);
    expect(hnItems[0].id).toBe(hnItem.id);
  });

  it('findAll() returns a copy so external mutation does not affect stored items', async () => {
    const repo = new InMemoryItemRepository();
    await repo.save(makeItem());

    const first = await repo.findAll();
    first.splice(0);
    const second = await repo.findAll();

    expect(second).toHaveLength(1);
  });
});

describe('JsonlFileRepository', () => {
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

  it('save() appends a JSON line to the file', async () => {
    const { JsonlFileRepository } = await import('../../src/collectors/repository.js');
    const repo = new JsonlFileRepository('/tmp/test.jsonl');
    const item = makeItem();

    await repo.save(item);

    expect(appendFileMock).toHaveBeenCalledOnce();
    const written = String(appendFileMock.mock.calls[0]?.[1] ?? '');
    expect(written).toContain(item.id);
    expect(written.endsWith('\n')).toBe(true);
  });

  it('saveAll() appends all items as JSONL lines', async () => {
    const { JsonlFileRepository } = await import('../../src/collectors/repository.js');
    const repo = new JsonlFileRepository('/tmp/test.jsonl');
    const items = [makeItem('hacker_news'), makeItem('reddit')];

    await repo.saveAll(items);

    expect(appendFileMock).toHaveBeenCalledOnce();
    const written = String(appendFileMock.mock.calls[0]?.[1] ?? '');
    expect(written).toContain(items[0].id);
    expect(written).toContain(items[1].id);
  });

  it('saveAll() does nothing when items array is empty', async () => {
    const { JsonlFileRepository } = await import('../../src/collectors/repository.js');
    const repo = new JsonlFileRepository('/tmp/test.jsonl');

    await repo.saveAll([]);

    expect(appendFileMock).not.toHaveBeenCalled();
  });

  it('findAll() returns empty array when readFile throws', async () => {
    readFileMock.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
    const { JsonlFileRepository } = await import('../../src/collectors/repository.js');
    const repo = new JsonlFileRepository('/tmp/nonexistent.jsonl');

    const items = await repo.findAll();

    expect(items).toEqual([]);
  });

  it('findAll() parses JSONL and restores Date objects', async () => {
    const item = makeItem();
    const jsonl = JSON.stringify(item) + '\n';
    readFileMock.mockResolvedValue(jsonl);
    const { JsonlFileRepository } = await import('../../src/collectors/repository.js');
    const repo = new JsonlFileRepository('/tmp/test.jsonl');

    const items = await repo.findAll();

    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(item.id);
    expect(items[0].collectedAt).toBeInstanceOf(Date);
  });

  it('findBySource() returns only items matching the source', async () => {
    const hnItem = makeItem('hacker_news');
    const redditItem = makeItem('reddit');
    const jsonl = [hnItem, redditItem].map((i) => JSON.stringify(i)).join('\n') + '\n';
    readFileMock.mockResolvedValue(jsonl);
    const { JsonlFileRepository } = await import('../../src/collectors/repository.js');
    const repo = new JsonlFileRepository('/tmp/test.jsonl');

    const hnItems = await repo.findBySource('hacker_news');

    expect(hnItems).toHaveLength(1);
    expect(hnItems[0].id).toBe(hnItem.id);
  });
});
