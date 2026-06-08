import { afterEach, describe, expect, it, vi } from 'vitest';
import { BlogPublisher } from '../../src/publisher/blog-publisher.js';
import { PublisherError } from '../../src/publisher/devto-publisher.js';
import type { IGitExecutor } from '../../src/publisher/blog-publisher.js';
import type { Draft } from '../../src/generators/types.js';

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

function makeGit(): IGitExecutor {
  return { exec: vi.fn().mockResolvedValue('') };
}

function makeDraft(): Draft {
  return {
    id: 'draft-blog-001',
    scoredItemId: 'scored-001',
    frontmatter: {
      title: 'How to Use PLATEAU 3D Data',
      description: 'A guide for 3D developers.',
      tags: ['geospatial', 'japan'],
      published: false,
    },
    contentMd: '---\ntitle: PLATEAU\n---\n\nContent.',
    status: 'pending',
    createdAt: new Date(),
  };
}

describe('BlogPublisher', () => {
  afterEach(() => vi.restoreAllMocks());

  it('writes Markdown file to blog posts directory', async () => {
    const { writeFile } = await import('node:fs/promises');
    const git = makeGit();
    const publisher = new BlogPublisher('blog', git);

    await publisher.publish(makeDraft(), '# Content here');

    expect(writeFile).toHaveBeenCalledOnce();
    const [filePath, content] = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(filePath)).toContain('posts');
    expect(String(filePath)).toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(String(content)).toBe('# Content here');
  });

  it('runs git add, commit, push', async () => {
    const git = makeGit();
    const publisher = new BlogPublisher('blog', git);

    await publisher.publish(makeDraft(), 'Content');

    expect(git.exec).toHaveBeenCalledTimes(3);
    const calls = (git.exec as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][0]).toContain('add');
    expect(calls[1][0]).toContain('commit');
    expect(calls[2][0]).toContain('push');
  });

  it('slugifies title to create filename', async () => {
    const { writeFile } = await import('node:fs/promises');
    const publisher = new BlogPublisher('blog', makeGit());

    await publisher.publish(makeDraft(), 'Content');

    const filePath = String((writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]);
    expect(filePath).toContain('how-to-use-plateau-3d-data');
  });

  it('throws PublisherError when git push fails', async () => {
    const git: IGitExecutor = {
      exec: vi.fn()
        .mockResolvedValueOnce('')  // git add
        .mockResolvedValueOnce('')  // git commit
        .mockRejectedValueOnce(new Error('remote rejected')),  // git push
    };
    const publisher = new BlogPublisher('blog', git);

    await expect(publisher.publish(makeDraft(), 'Content')).rejects.toThrow(PublisherError);
  });
});
