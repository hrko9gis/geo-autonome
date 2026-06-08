import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryScoredItemRepository } from '../../src/summarizers/repository.js';
import type { ScoredItem } from '../../src/summarizers/types.js';

vi.mock('node:fs/promises', () => ({
  appendFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(''),
}));

function makeScoredItem(selected = true): ScoredItem {
  return {
    id: crypto.randomUUID(),
    rawItemId: crypto.randomUUID(),
    source: 'hacker_news',
    title: 'Geospatial article',
    summaryEn: 'A summary about geospatial tech',
    relevanceScore: 80,
    noveltyScore: 70,
    potentialScore: 60,
    totalScore: 72,
    selected,
    scoredAt: new Date('2026-05-29T00:00:00Z'),
  };
}

describe('InMemoryScoredItemRepository', () => {
  it('save() stores a single item', async () => {
    const repo = new InMemoryScoredItemRepository();
    const item = makeScoredItem();
    await repo.save(item);
    const all = await repo.findAll();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(item.id);
  });

  it('saveAll() stores multiple items', async () => {
    const repo = new InMemoryScoredItemRepository();
    await repo.saveAll([makeScoredItem(), makeScoredItem()]);
    const all = await repo.findAll();
    expect(all).toHaveLength(2);
  });

  it('findAll() returns a copy (mutation safe)', async () => {
    const repo = new InMemoryScoredItemRepository();
    await repo.save(makeScoredItem());
    const first = await repo.findAll();
    first.splice(0);
    expect((await repo.findAll())).toHaveLength(1);
  });

  it('findBySelected(true) returns only selected items', async () => {
    const repo = new InMemoryScoredItemRepository();
    const selected = makeScoredItem(true);
    const notSelected = makeScoredItem(false);
    await repo.saveAll([selected, notSelected]);
    const result = await repo.findBySelected(true);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(selected.id);
  });

  it('findBySelected(false) returns only unselected items', async () => {
    const repo = new InMemoryScoredItemRepository();
    await repo.saveAll([makeScoredItem(true), makeScoredItem(false)]);
    const result = await repo.findBySelected(false);
    expect(result).toHaveLength(1);
    expect(result[0].selected).toBe(false);
  });
});

describe('JsonlScoredItemRepository', () => {
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
    const { JsonlScoredItemRepository } = await import('../../src/summarizers/repository.js');
    const repo = new JsonlScoredItemRepository('/tmp/scored.jsonl');
    const item = makeScoredItem();
    await repo.save(item);
    expect(appendFileMock).toHaveBeenCalledOnce();
    const written = String(appendFileMock.mock.calls[0]?.[1] ?? '');
    expect(written).toContain(item.id);
    expect(written.endsWith('\n')).toBe(true);
  });

  it('findAll() returns empty array when file not found', async () => {
    readFileMock.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
    const { JsonlScoredItemRepository } = await import('../../src/summarizers/repository.js');
    const repo = new JsonlScoredItemRepository('/tmp/nonexistent.jsonl');
    expect(await repo.findAll()).toEqual([]);
  });

  it('findAll() parses JSONL and restores Date', async () => {
    const item = makeScoredItem();
    readFileMock.mockResolvedValue(JSON.stringify(item) + '\n');
    const { JsonlScoredItemRepository } = await import('../../src/summarizers/repository.js');
    const repo = new JsonlScoredItemRepository('/tmp/scored.jsonl');
    const items = await repo.findAll();
    expect(items[0].scoredAt).toBeInstanceOf(Date);
  });
});
