import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RedditCollector } from '../../src/collectors/reddit.js';
import { CollectorError } from '../../src/collectors/errors.js';

const ATOM_XML = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>t3_abc</id>
    <title>Best GIS tools 2025</title>
    <link href="https://www.reddit.com/r/gis/comments/abc/best_gis_tools/" />
    <content type="html">Discussion about GIS tools</content>
  </entry>
</feed>`;

describe('RedditCollector', () => {
  let collector: RedditCollector;

  beforeEach(() => {
    collector = new RedditCollector();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns RawItems from subreddit RSS feed', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response(ATOM_XML, { status: 200 })),
    );

    const items = await collector.collect();
    expect(items.length).toBeGreaterThan(0);
    const item = items[0];
    expect(item.source).toBe('reddit');
    expect(item.externalId).toBe('t3_abc');
    expect(item.title).toBe('Best GIS tools 2025');
    expect(item.id).toBeTruthy();
    expect(item.collectedAt).toBeInstanceOf(Date);
  });

  it('throws CollectorError on network failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    await expect(collector.collect()).rejects.toThrow(CollectorError);
  });

  it('throws CollectorError when every subreddit fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response('', { status: 429 })),
    );

    await expect(collector.collect()).rejects.toThrow(CollectorError);
  });

  it('skips subreddits that return 403 and still returns items from others', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/r/gamedev/')) {
        return Promise.resolve(new Response('', { status: 403 }));
      }
      return Promise.resolve(new Response(ATOM_XML, { status: 200 }));
    });

    const items = await collector.collect();
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => item.source === 'reddit')).toBe(true);
  });

  it('collects from all required subreddits including gamedev and vrchat', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response(ATOM_XML, { status: 200 })),
    );

    await collector.collect();

    const calledUrls = fetchSpy.mock.calls.map((call) => String(call[0]));
    const requiredSubreddits = ['gamedev', 'Unity3D', 'unrealengine', 'blender', 'gis', 'vrchat'];
    for (const sub of requiredSubreddits) {
      expect(calledUrls.some((url) => url.includes(`/r/${sub}/`))).toBe(true);
    }
  });
});
