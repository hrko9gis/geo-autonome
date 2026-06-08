import { afterEach, describe, expect, it, vi } from 'vitest';
import { URLShortenerClient } from '../../src/publisher/url-shortener.js';

describe('URLShortenerClient', () => {
  afterEach(() => vi.restoreAllMocks());

  describe('shorten()', () => {
    it('returns the original URL when baseUrl is undefined', async () => {
      const client = new URLShortenerClient(undefined);
      const result = await client.shorten('https://example.com/page', 'post-1');
      expect(result).toBe('https://example.com/page');
    });

    it('POSTs to /api/shorten and returns shortUrl', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ shortUrl: 'https://short.ly/abc' }), { status: 200 }),
      );
      const client = new URLShortenerClient('https://short.ly');

      const result = await client.shorten('https://example.com/long-page', 'post-1');

      expect(result).toBe('https://short.ly/abc');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://short.ly/api/shorten',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('returns original URL when API call fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('', { status: 500 }),
      );
      const client = new URLShortenerClient('https://short.ly');

      const result = await client.shorten('https://example.com/page', 'post-1');
      expect(result).toBe('https://example.com/page');
    });
  });

  describe('replaceLinks()', () => {
    it('returns content unchanged when baseUrl is undefined', async () => {
      const client = new URLShortenerClient(undefined);
      const content = 'See [this page](https://example.com/page) for details.';
      expect(await client.replaceLinks(content, 'post-1')).toBe(content);
    });

    it('replaces Markdown links with short URLs', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ shortUrl: 'https://geo.ex/r/abc' }), { status: 200 }),
      );
      const client = new URLShortenerClient('https://geo.ex');

      const content = 'Buy [templates](https://gumroad.com/l/templates) here.';
      const result = await client.replaceLinks(content, 'post-1');

      expect(result).toContain('https://geo.ex/r/abc');
      expect(result).not.toContain('https://gumroad.com/l/templates');
    });

    it('leaves content unchanged when no URLs found', async () => {
      const client = new URLShortenerClient('https://short.ly');
      const content = 'No links here, just plain text.';
      expect(await client.replaceLinks(content, 'post-1')).toBe(content);
    });

    it('replaces all occurrences when the same URL appears multiple times', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ shortUrl: 'https://geo.ex/r/xyz' }), { status: 200 }),
        ),
      );
      const client = new URLShortenerClient('https://geo.ex');
      const content =
        'See [A](https://gumroad.com/l/prod) and [B](https://gumroad.com/l/prod) for details.';
      const result = await client.replaceLinks(content, 'post-1');

      const remaining = result.match(/https:\/\/gumroad\.com\/l\/prod/g);
      expect(remaining).toBeNull();
    });
  });
});
