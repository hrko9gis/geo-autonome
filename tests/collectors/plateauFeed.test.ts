import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlateauFeedCollector } from '../../src/collectors/plateauFeed.js';
import { CollectorError } from '../../src/collectors/errors.js';

const RSS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>PLATEAU</title>
    <item>
      <title>新しい3D都市モデルデータを公開</title>
      <link>https://www.mlit.go.jp/plateau/news/001</link>
      <description>東京都の3D都市モデルを更新しました。</description>
      <guid>https://www.mlit.go.jp/plateau/news/001</guid>
    </item>
  </channel>
</rss>`;

const ATOM_XML = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>PLATEAU Catalog</title>
  <entry>
    <id>urn:plateau:001</id>
    <title type="text">東京都 3Dモデル</title>
    <link href="https://example.com/plateau/001" rel="alternate"/>
    <summary>東京都の建物データ</summary>
  </entry>
</feed>`;

describe('PlateauFeedCollector', () => {
  let collector: PlateauFeedCollector;

  beforeEach(() => {
    collector = new PlateauFeedCollector();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses RSS feed into RawItems', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response(RSS_XML, { status: 200 })),
    );

    const items = await collector.collect();
    expect(items.length).toBeGreaterThan(0);
    const item = items[0];
    expect(item.source).toBe('plateau');
    expect(item.title).toBe('新しい3D都市モデルデータを公開');
    expect(item.url).toBe('https://www.mlit.go.jp/plateau/news/001');
    expect(item.id).toBeTruthy();
  });

  it('parses Atom feed into RawItems', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response(ATOM_XML, { status: 200 })),
    );

    const items = await collector.collect();
    expect(items.length).toBeGreaterThan(0);
    const item = items[0];
    expect(item.source).toBe('plateau');
    expect(item.id).toBeTruthy();
  });

  it('skips feed URLs that return 404', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response('', { status: 404 })),
    );

    const items = await collector.collect();
    expect(items).toEqual([]);
  });

  it('returns empty array when all URLs fail with network errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    const items = await collector.collect();
    expect(items).toEqual([]);
  });

  it('throws CollectorError on non-200/404 response', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response('', { status: 500 })),
    );

    await expect(collector.collect()).rejects.toThrow(CollectorError);
  });

  it('monitors GSI and MLIT feeds in addition to PLATEAU feeds', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response('', { status: 404 })),
    );

    await collector.collect();

    const calledUrls = fetchSpy.mock.calls.map((call) => String(call[0]));
    expect(calledUrls.some((url) => url.includes('gsi.go.jp'))).toBe(true);
    expect(calledUrls.some((url) => url.includes('mlit.go.jp'))).toBe(true);
    expect(calledUrls.length).toBeGreaterThanOrEqual(4);
  });
});
