import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryClickRepository } from '../../src/metrics/click-repository.js';
import type { Click } from '../../src/metrics/types.js';

vi.mock('node:fs/promises', () => ({
  appendFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(''),
}));

function makeClick(shortUrlId = 'url-1', country?: string): Click {
  return {
    id: crypto.randomUUID(),
    shortUrlId,
    clickedAt: new Date('2026-05-30T10:00:00Z'),
    country,
  };
}

describe('InMemoryClickRepository', () => {
  it('save() stores a click', async () => {
    const repo = new InMemoryClickRepository();
    await repo.save(makeClick());
    expect(await repo.findAll()).toHaveLength(1);
  });

  it('saveAll() stores multiple clicks', async () => {
    const repo = new InMemoryClickRepository();
    await repo.saveAll([makeClick(), makeClick()]);
    expect(await repo.findAll()).toHaveLength(2);
  });

  it('findAll() returns a copy (mutation safe)', async () => {
    const repo = new InMemoryClickRepository();
    await repo.save(makeClick());
    const first = await repo.findAll();
    first.splice(0);
    expect(await repo.findAll()).toHaveLength(1);
  });

  it('findByShortUrlId() returns only matching clicks', async () => {
    const repo = new InMemoryClickRepository();
    await repo.save(makeClick('url-A'));
    await repo.save(makeClick('url-B'));
    const result = await repo.findByShortUrlId('url-A');
    expect(result).toHaveLength(1);
    expect(result[0].shortUrlId).toBe('url-A');
  });

  it('countByShortUrlId() counts correctly', async () => {
    const repo = new InMemoryClickRepository();
    await repo.saveAll([makeClick('url-X'), makeClick('url-X'), makeClick('url-Y')]);
    expect(await repo.countByShortUrlId('url-X')).toBe(2);
    expect(await repo.countByShortUrlId('url-Y')).toBe(1);
    expect(await repo.countByShortUrlId('url-Z')).toBe(0);
  });
});

describe('JsonlClickRepository', () => {
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
    const { JsonlClickRepository } = await import('../../src/metrics/click-repository.js');
    const repo = new JsonlClickRepository('/tmp/clicks.jsonl');
    const click = makeClick();
    await repo.save(click);
    expect(appendFileMock).toHaveBeenCalledOnce();
    expect(String(appendFileMock.mock.calls[0]?.[1] ?? '')).toContain(click.id);
  });

  it('findAll() returns empty when file not found', async () => {
    readFileMock.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
    const { JsonlClickRepository } = await import('../../src/metrics/click-repository.js');
    expect(await new JsonlClickRepository('/tmp/nonexistent.jsonl').findAll()).toEqual([]);
  });

  it('findAll() parses JSONL and restores Date', async () => {
    const click = makeClick();
    readFileMock.mockResolvedValue(JSON.stringify(click) + '\n');
    const { JsonlClickRepository } = await import('../../src/metrics/click-repository.js');
    const clicks = await new JsonlClickRepository('/tmp/clicks.jsonl').findAll();
    expect(clicks[0].clickedAt).toBeInstanceOf(Date);
  });

  it('findByShortUrlId() returns only matching clicks from file', async () => {
    const clickA = makeClick('url-A');
    const clickB = makeClick('url-B');
    readFileMock.mockResolvedValue([JSON.stringify(clickA), JSON.stringify(clickB)].join('\n') + '\n');
    const { JsonlClickRepository } = await import('../../src/metrics/click-repository.js');
    const result = await new JsonlClickRepository('/tmp/clicks.jsonl').findByShortUrlId('url-A');
    expect(result).toHaveLength(1);
    expect(result[0].shortUrlId).toBe('url-A');
  });

  it('countByShortUrlId() counts from file correctly', async () => {
    const clicks = [makeClick('url-X'), makeClick('url-X'), makeClick('url-Y')];
    readFileMock.mockResolvedValue(clicks.map((c) => JSON.stringify(c)).join('\n') + '\n');
    const { JsonlClickRepository } = await import('../../src/metrics/click-repository.js');
    const repo = new JsonlClickRepository('/tmp/clicks.jsonl');
    expect(await repo.countByShortUrlId('url-X')).toBe(2);
    expect(await repo.countByShortUrlId('url-Y')).toBe(1);
  });
});
