import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { JsonlDraftRepository } from './generators/repository.js';
import { DiscordNotifier } from './notifier/discord-notifier.js';
import { SlackNotifier } from './notifier/slack-notifier.js';
import type { INotifier } from './notifier/types.js';

const INPUT_FILE = path.join('data', 'drafts.jsonl');
const DEFAULT_APPROVAL_BASE_URL = 'http://100.64.0.1:8080';

function buildNotifier(
  slackUrl: string | undefined,
  discordUrl: string | undefined,
): INotifier | null {
  if (slackUrl) return new SlackNotifier(slackUrl);
  if (discordUrl) return new DiscordNotifier(discordUrl);
  return null;
}

export async function main(): Promise<void> {
  const slackUrl = process.env['SLACK_WEBHOOK_URL'];
  const discordUrl = process.env['DISCORD_WEBHOOK_URL'];
  const approvalBaseUrl = process.env['APPROVAL_SERVER_URL'] ?? DEFAULT_APPROVAL_BASE_URL;

  const notifier = buildNotifier(slackUrl, discordUrl);
  if (!notifier) {
    console.warn(
      '[notify-cli] No webhook URL configured. ' +
        'Set SLACK_WEBHOOK_URL or DISCORD_WEBHOOK_URL to enable notifications.',
    );
    return;
  }

  const draftRepo = new JsonlDraftRepository(INPUT_FILE);
  const pending = await draftRepo.findByStatus('pending');

  if (pending.length === 0) {
    console.log('[notify-cli] No pending drafts to notify.');
    return;
  }

  let notified = 0;
  for (const draft of pending) {
    const approvalUrl = `${approvalBaseUrl}/drafts/${draft.id}`;
    await notifier.notifyDraftReady(draft, approvalUrl);
    notified++;
  }

  console.log(`[notify-cli] Sent ${notified} notification(s).`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err: unknown) => {
    console.error('[notify-cli] Unexpected error:', err);
    process.exit(1);
  });
}
