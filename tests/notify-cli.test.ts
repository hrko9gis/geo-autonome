import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', () => ({
  appendFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(''),
}));

const mockNotifyDraftReady = vi.fn().mockResolvedValue(undefined);

vi.mock('../src/notifier/slack-notifier.js', () => ({
  SlackNotifier: vi.fn().mockImplementation(() => ({
    notifyDraftReady: mockNotifyDraftReady,
    notifyPublishError: vi.fn(),
  })),
}));

vi.mock('../src/notifier/discord-notifier.js', () => ({
  DiscordNotifier: vi.fn().mockImplementation(() => ({
    notifyDraftReady: mockNotifyDraftReady,
    notifyPublishError: vi.fn(),
  })),
}));

const fakePendingDraft = JSON.stringify({
  id: 'draft-pending-1',
  scoredItemId: 'scored-1',
  frontmatter: {
    title: 'Geospatial Article',
    description: 'About geospatial data',
    tags: ['gis'],
    published: false,
  },
  contentMd: '---\ntitle: Geospatial Article\n---\n\nContent.',
  status: 'pending',
  createdAt: new Date().toISOString(),
});

describe('notify-cli main()', () => {
  beforeEach(() => {
    mockNotifyDraftReady.mockClear();
  });

  afterEach(() => {
    delete process.env['SLACK_WEBHOOK_URL'];
    delete process.env['DISCORD_WEBHOOK_URL'];
    delete process.env['APPROVAL_SERVER_URL'];
    vi.clearAllMocks();
  });

  it('does not throw when no webhook URL is configured', async () => {
    delete process.env['SLACK_WEBHOOK_URL'];
    delete process.env['DISCORD_WEBHOOK_URL'];
    const { main } = await import('../src/notify-cli.js');
    await expect(main()).resolves.toBeUndefined();
  });

  it('calls notifyDraftReady for each pending draft when SLACK_WEBHOOK_URL is set', async () => {
    process.env['SLACK_WEBHOOK_URL'] = 'https://hooks.slack.com/test';
    process.env['APPROVAL_SERVER_URL'] = 'http://100.1.2.3:8080';

    const { readFile } = await import('node:fs/promises');
    (readFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce(fakePendingDraft + '\n');

    const { main } = await import('../src/notify-cli.js');
    await main();

    expect(mockNotifyDraftReady).toHaveBeenCalledOnce();
    const [, approvalUrl] = mockNotifyDraftReady.mock.calls[0];
    expect(approvalUrl).toContain('draft-pending-1');
    expect(approvalUrl).toContain('100.1.2.3');
  });

  it('calls notifyDraftReady when DISCORD_WEBHOOK_URL is set', async () => {
    process.env['DISCORD_WEBHOOK_URL'] = 'https://discord.com/api/webhooks/test';

    const { readFile } = await import('node:fs/promises');
    (readFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce(fakePendingDraft + '\n');

    const { main } = await import('../src/notify-cli.js');
    await main();

    expect(mockNotifyDraftReady).toHaveBeenCalledOnce();
  });

  it('does not call notifyDraftReady when there are no pending drafts', async () => {
    process.env['SLACK_WEBHOOK_URL'] = 'https://hooks.slack.com/test';
    const { main } = await import('../src/notify-cli.js');
    await main();
    expect(mockNotifyDraftReady).not.toHaveBeenCalled();
  });
});
