import { afterEach, describe, expect, it, vi } from 'vitest';
import { DevToPublisher, PublisherError } from '../../src/publisher/devto-publisher.js';
import type { Draft } from '../../src/generators/types.js';

function makeDraft(): Draft {
  return {
    id: 'draft-001',
    scoredItemId: 'scored-001',
    frontmatter: {
      title: 'How to Use PLATEAU in Unity',
      description: 'A guide for Unity developers.',
      tags: ['geospatial', 'japan', 'unity', '3d'],
      published: false,
    },
    contentMd: '---\ntitle: How to Use PLATEAU\n---\n\nContent here.',
    status: 'pending',
    createdAt: new Date(),
  };
}

describe('DevToPublisher', () => {
  afterEach(() => vi.restoreAllMocks());

  it('POSTs to dev.to API with api-key header', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ url: 'https://dev.to/user/article' }), { status: 201 }),
    );

    const publisher = new DevToPublisher('test-api-key');
    await publisher.publish(makeDraft(), 'Content here.');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://dev.to/api/articles',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'api-key': 'test-api-key' }),
      }),
    );
  });

  it('returns the article URL on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ url: 'https://dev.to/user/plateau-guide' }), { status: 201 }),
    );

    const publisher = new DevToPublisher('test-api-key');
    const url = await publisher.publish(makeDraft(), 'Content.');

    expect(url).toBe('https://dev.to/user/plateau-guide');
  });

  it('throws PublisherError on 4xx response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Unauthorized', { status: 401 }),
    );

    const publisher = new DevToPublisher('bad-key');
    await expect(publisher.publish(makeDraft(), 'Content.')).rejects.toThrow(PublisherError);
  });

  it('throws PublisherError on 5xx response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Server Error', { status: 500 }),
    );

    const publisher = new DevToPublisher('test-key');
    await expect(publisher.publish(makeDraft(), 'Content.')).rejects.toThrow(PublisherError);
  });

  it('throws PublisherError on network failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    const publisher = new DevToPublisher('test-key');
    await expect(publisher.publish(makeDraft(), 'Content.')).rejects.toThrow(PublisherError);
  });

  it('sends the markdown content in body_markdown', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ url: 'https://dev.to/user/article' }), { status: 201 }),
    );

    const publisher = new DevToPublisher('test-key');
    await publisher.publish(makeDraft(), '# My Article\n\nHello world');

    const bodyStr = String((fetchSpy.mock.calls[0]?.[1] as RequestInit).body);
    const body = JSON.parse(bodyStr);
    expect(body.article.body_markdown).toContain('Hello world');
  });

  it('publishes with published: true by default', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ url: 'https://dev.to/user/article' }), { status: 201 }),
    );

    const publisher = new DevToPublisher('test-key');
    await publisher.publish(makeDraft(), 'Content.');

    const bodyStr = String((fetchSpy.mock.calls[0]?.[1] as RequestInit).body);
    const body = JSON.parse(bodyStr);
    expect(body.article.published).toBe(true);
  });
});
