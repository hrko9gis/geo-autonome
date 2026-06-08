import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EStatCollector } from '../../src/collectors/estat.js';
import { CollectorError } from '../../src/collectors/errors.js';

const mockTable = {
  '@id': 'T000001',
  STAT_NAME: { $: '国勢調査' },
  TABLE_NAME: '地理空間統計表',
};

const mockEStatResponse = {
  GET_STATS_LIST: {
    DATALIST_INF: {
      TABLE_INF: [mockTable],
    },
  },
};

describe('EStatCollector', () => {
  let collector: EStatCollector;

  beforeEach(() => {
    collector = new EStatCollector();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env['ESTAT_API_KEY'];
  });

  it('returns empty array when ESTAT_API_KEY is not set', async () => {
    delete process.env['ESTAT_API_KEY'];
    const items = await collector.collect();
    expect(items).toEqual([]);
  });

  it('returns RawItems when API key is set', async () => {
    process.env['ESTAT_API_KEY'] = 'test-key';
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify(mockEStatResponse), { status: 200 })),
    );

    const items = await collector.collect();
    expect(items.length).toBeGreaterThan(0);
    const item = items[0];
    expect(item.source).toBe('estat');
    expect(item.externalId).toBe('T000001');
    expect(item.title).toContain('地理空間統計表');
    expect(item.id).toBeTruthy();
  });

  it('throws CollectorError on network failure', async () => {
    process.env['ESTAT_API_KEY'] = 'test-key';
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    await expect(collector.collect()).rejects.toThrow(CollectorError);
  });

  it('throws CollectorError on non-200 response', async () => {
    process.env['ESTAT_API_KEY'] = 'test-key';
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response('', { status: 403 })),
    );

    await expect(collector.collect()).rejects.toThrow(CollectorError);
  });

  it('deduplicates items with the same @id across queries', async () => {
    process.env['ESTAT_API_KEY'] = 'test-key';
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify(mockEStatResponse), { status: 200 })),
    );

    const items = await collector.collect();
    const externalIds = items.map((i) => i.externalId);
    expect(new Set(externalIds).size).toBe(externalIds.length);
  });

  it('queries include map and regional search words', async () => {
    process.env['ESTAT_API_KEY'] = 'test-key';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify(mockEStatResponse), { status: 200 })),
    );

    await collector.collect();

    const calledUrls = fetchSpy.mock.calls.map((call) => decodeURIComponent(String(call[0])));
    expect(calledUrls.some((url) => url.includes('地図'))).toBe(true);
    expect(calledUrls.some((url) => url.includes('地域'))).toBe(true);
    expect(fetchSpy.mock.calls.length).toBeGreaterThanOrEqual(5);
  });
});
