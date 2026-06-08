import { describe, expect, it, vi } from 'vitest';
import { Publisher } from '../../src/publisher/publisher.js';
import { InMemoryPostRepository } from '../../src/publisher/repository.js';
import { URLShortenerClient } from '../../src/publisher/url-shortener.js';
import type { DevToPublisher } from '../../src/publisher/devto-publisher.js';
import type { BlogPublisher } from '../../src/publisher/blog-publisher.js';
import type { INotifier } from '../../src/notifier/types.js';
import type { Draft } from '../../src/generators/types.js';

function makeDraft(): Draft {
  return {
    id: 'draft-pub-001',
    scoredItemId: 'scored-001',
    frontmatter: {
      title: 'Test Article',
      description: 'A test article',
      tags: ['geospatial'],
      published: false,
    },
    contentMd: '---\ntitle: Test\n---\n\nSee [product](https://gumroad.com/l/test).',
    status: 'pending',
    createdAt: new Date(),
  };
}

function makeNotifier(): INotifier {
  return {
    notifyDraftReady: vi.fn().mockResolvedValue(undefined),
    notifyPublishError: vi.fn().mockResolvedValue(undefined),
  };
}

function makeDevTo(url = 'https://dev.to/user/test-article'): DevToPublisher {
  return { publish: vi.fn().mockResolvedValue(url) } as unknown as DevToPublisher;
}

function makeBlog(path = 'blog/src/content/posts/2026-05-29-test.md'): BlogPublisher {
  return { publish: vi.fn().mockResolvedValue(path) } as unknown as BlogPublisher;
}

describe('Publisher', () => {
  it('publishes to devto and saves a Post', async () => {
    const postRepo = new InMemoryPostRepository();
    const notifier = makeNotifier();
    const publisher = new Publisher(makeDevTo(), null, new URLShortenerClient(undefined), notifier, []);

    const posts = await publisher.publish(makeDraft(), ['devto'], postRepo);

    expect(posts).toHaveLength(1);
    expect(posts[0].platform).toBe('devto');
    expect(posts[0].externalUrl).toBe('https://dev.to/user/test-article');

    const saved = await postRepo.findAll();
    expect(saved).toHaveLength(1);
  });

  it('publishes to blog and saves a Post', async () => {
    const postRepo = new InMemoryPostRepository();
    const publisher = new Publisher(null, makeBlog(), new URLShortenerClient(undefined), makeNotifier(), []);

    const posts = await publisher.publish(makeDraft(), ['blog'], postRepo);

    expect(posts).toHaveLength(1);
    expect(posts[0].platform).toBe('blog');
  });

  it('publishes to both targets', async () => {
    const postRepo = new InMemoryPostRepository();
    const publisher = new Publisher(makeDevTo(), makeBlog(), new URLShortenerClient(undefined), makeNotifier(), []);

    const posts = await publisher.publish(makeDraft(), ['devto', 'blog'], postRepo);

    expect(posts).toHaveLength(2);
    expect(posts.map((p) => p.platform).sort()).toEqual(['blog', 'devto']);
  });

  it('continues publishing blog when devto fails', async () => {
    const failingDevTo = { publish: vi.fn().mockRejectedValue(new Error('API error')) } as unknown as DevToPublisher;
    const blog = makeBlog();
    const notifier = makeNotifier();
    const postRepo = new InMemoryPostRepository();
    const publisher = new Publisher(failingDevTo, blog, new URLShortenerClient(undefined), notifier, []);

    const posts = await publisher.publish(makeDraft(), ['devto', 'blog'], postRepo);

    expect(posts).toHaveLength(1);
    expect(posts[0].platform).toBe('blog');
    expect(notifier.notifyPublishError).toHaveBeenCalledWith('draft-pub-001', expect.stringContaining('dev.to'));
  });

  it('calls notifyPublishError when devto fails after all retries', async () => {
    const failingDevTo = { publish: vi.fn().mockRejectedValue(new Error('Network error')) } as unknown as DevToPublisher;
    const notifier = makeNotifier();
    const postRepo = new InMemoryPostRepository();
    const publisher = new Publisher(failingDevTo, null, new URLShortenerClient(undefined), notifier, []);

    await publisher.publish(makeDraft(), ['devto'], postRepo);

    expect(notifier.notifyPublishError).toHaveBeenCalledOnce();
    expect(failingDevTo.publish).toHaveBeenCalledTimes(3);
  });

  it('retries exactly 3 times on failure', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));
    const devto = { publish: fn } as unknown as DevToPublisher;
    const publisher = new Publisher(devto, null, new URLShortenerClient(undefined), makeNotifier(), []);

    await publisher.publish(makeDraft(), ['devto'], new InMemoryPostRepository());

    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('skips devto when devto is null', async () => {
    const blog = makeBlog();
    const publisher = new Publisher(null, blog, new URLShortenerClient(undefined), makeNotifier(), []);

    const posts = await publisher.publish(makeDraft(), ['devto', 'blog'], new InMemoryPostRepository());

    expect(posts).toHaveLength(1);
    expect(posts[0].platform).toBe('blog');
  });
});
