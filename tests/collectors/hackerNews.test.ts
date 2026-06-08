import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HackerNewsCollector } from '../../src/collectors/hackerNews.js';
import { CollectorError } from '../../src/collectors/errors.js';

const mockHit = {
  objectID: 'abc123',
  title: 'Geospatial Databases in 2025',
  url: 'https://example.com/geo',
  created_at: '2025-01-01T00:00:00Z',
};

describe('HackerNewsCollector', () => {
  let collector: HackerNewsCollector;

  beforeEach(() => {
    collector = new HackerNewsCollector();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns RawItems from API response', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ hits: [mockHit] }), { status: 200 })),
    );

    const items = await collector.collect();
    expect(items.length).toBeGreaterThan(0);
    const item = items[0];
    expect(item.source).toBe('hacker_news');
    expect(item.externalId).toBe('abc123');
    expect(item.title).toBe('Geospatial Databases in 2025');
    expect(item.url).toBe('https://example.com/geo');
    expect(item.id).toBeTruthy();
    expect(item.collectedAt).toBeInstanceOf(Date);
  });

  it('deduplicates items with the same objectID across queries', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ hits: [mockHit] }), { status: 200 })),
    );

    const items = await collector.collect();
    const ids = items.map((i) => i.externalId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('throws CollectorError on network failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    await expect(collector.collect()).rejects.toThrow(CollectorError);
  });

  it('throws CollectorError on non-200 response', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response('', { status: 500 })),
    );

    await expect(collector.collect()).rejects.toThrow(CollectorError);
  });

  it('queries include 3D and data visualization related keywords', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ hits: [] }), { status: 200 })),
    );

    await collector.collect();

    const calledUrls = fetchSpy.mock.calls.map((call) => decodeURIComponent(String(call[0])));
    const has3dKeyword = calledUrls.some((url) =>
      url.toLowerCase().includes('3d') || url.includes('deck.gl') || url.includes('Blender'),
    );
    expect(has3dKeyword).toBe(true);
    expect(fetchSpy.mock.calls.length).toBeGreaterThanOrEqual(5);
  });
});
