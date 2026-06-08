import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiscordNotifier } from '../../src/notifier/discord-notifier.js';
import type { Draft } from '../../src/generators/types.js';

function makeDraft(): Draft {
  return {
    id: 'draft-002',
    scoredItemId: 'scored-002',
    frontmatter: {
      title: 'Visualizing Japan GIS Data',
      description: 'How to visualize GIS data from Japan.',
      tags: ['gis', 'japan'],
      published: false,
    },
    contentMd: '---\ntitle: Visualizing Japan GIS Data\n---\n\nContent.',
    status: 'pending',
    createdAt: new Date(),
  };
}

describe('DiscordNotifier', () => {
  afterEach(() => vi.restoreAllMocks());

  it('notifyDraftReady POSTs to the Discord webhook URL', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 200 }));
    const notifier = new DiscordNotifier('https://discord.com/api/webhooks/test');

    await notifier.notifyDraftReady(makeDraft(), 'http://100.1.2.3:8080/drafts/draft-002');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://discord.com/api/webhooks/test',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('payload has content field containing title and approval URL', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 200 }));
    const notifier = new DiscordNotifier('https://discord.com/api/webhooks/test');

    await notifier.notifyDraftReady(makeDraft(), 'http://100.1.2.3:8080/drafts/draft-002');

    const body = JSON.parse(String((fetchSpy.mock.calls[0]?.[1] as RequestInit).body));
    expect(body).toHaveProperty('content');
    expect(body.content).toContain('Visualizing Japan GIS Data');
    expect(body.content).toContain('100.1.2.3');
  });

  it('does not throw when fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Connection refused'));
    const notifier = new DiscordNotifier('https://discord.com/api/webhooks/test');

    await expect(notifier.notifyDraftReady(makeDraft(), 'http://100.1.2.3:8080')).resolves.toBeUndefined();
  });

  it('notifyPublishError sends content with draftId', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 200 }));
    const notifier = new DiscordNotifier('https://discord.com/api/webhooks/test');

    await notifier.notifyPublishError('draft-002', 'Upload failed');

    const body = JSON.parse(String((fetchSpy.mock.calls[0]?.[1] as RequestInit).body));
    expect(body.content).toContain('draft-002');
    expect(body.content).toContain('Upload failed');
  });
});
