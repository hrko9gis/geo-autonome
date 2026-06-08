import { afterEach, describe, expect, it, vi } from 'vitest';
import { SlackNotifier } from '../../src/notifier/slack-notifier.js';
import type { Draft } from '../../src/generators/types.js';

function makeDraft(override: Partial<Draft> = {}): Draft {
  return {
    id: 'draft-001',
    scoredItemId: 'scored-001',
    frontmatter: {
      title: 'How to Use PLATEAU 3D Models',
      description: 'A practical guide for developers.',
      tags: ['geospatial', 'japan'],
      published: false,
    },
    contentMd: '---\ntitle: How to Use PLATEAU 3D Models\n---\n\nContent here.',
    status: 'pending',
    createdAt: new Date(),
    ...override,
  };
}

describe('SlackNotifier', () => {
  afterEach(() => vi.restoreAllMocks());

  it('notifyDraftReady POSTs to the webhook URL', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok', { status: 200 }));
    const notifier = new SlackNotifier('https://hooks.slack.com/test');

    await notifier.notifyDraftReady(makeDraft(), 'http://100.1.2.3:8080/drafts/draft-001');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://hooks.slack.com/test',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('payload contains the draft title', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok', { status: 200 }));
    const notifier = new SlackNotifier('https://hooks.slack.com/test');
    const draft = makeDraft();

    await notifier.notifyDraftReady(draft, 'http://100.1.2.3:8080/drafts/draft-001');

    const body = JSON.parse(String((fetchSpy.mock.calls[0]?.[1] as RequestInit).body));
    expect(JSON.stringify(body)).toContain('How to Use PLATEAU 3D Models');
  });

  it('payload contains the approval URL', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok', { status: 200 }));
    const notifier = new SlackNotifier('https://hooks.slack.com/test');

    await notifier.notifyDraftReady(makeDraft(), 'http://100.1.2.3:8080/drafts/draft-001');

    const body = JSON.stringify((fetchSpy.mock.calls[0]?.[1] as RequestInit).body);
    expect(body).toContain('100.1.2.3');
  });

  it('does not throw when fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));
    const notifier = new SlackNotifier('https://hooks.slack.com/test');

    await expect(notifier.notifyDraftReady(makeDraft(), 'http://100.1.2.3:8080/drafts/draft-001')).resolves.toBeUndefined();
  });

  it('notifyPublishError POSTs error details', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok', { status: 200 }));
    const notifier = new SlackNotifier('https://hooks.slack.com/test');

    await notifier.notifyPublishError('draft-001', 'API timeout');

    expect(fetchSpy).toHaveBeenCalledOnce();
    const body = JSON.stringify((fetchSpy.mock.calls[0]?.[1] as RequestInit).body);
    expect(body).toContain('draft-001');
  });
});
