import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { JsonlApprovalRepository } from './approval/repository.js';
import { JsonlDraftRepository } from './generators/repository.js';
import { DiscordNotifier } from './notifier/discord-notifier.js';
import { SlackNotifier } from './notifier/slack-notifier.js';
import type { INotifier } from './notifier/types.js';
import { BlogPublisher } from './publisher/blog-publisher.js';
import { DevToPublisher } from './publisher/devto-publisher.js';
import { JsonlPostRepository } from './publisher/repository.js';
import { Publisher } from './publisher/publisher.js';
import type { PublishTarget } from './publisher/types.js';
import { URLShortenerClient } from './publisher/url-shortener.js';

const DRAFTS_FILE = path.join('data', 'drafts.jsonl');
const APPROVALS_FILE = path.join('data', 'approvals.jsonl');
const POSTS_FILE = path.join('data', 'posts.jsonl');

function buildNotifier(): INotifier {
  const slackUrl = process.env['SLACK_WEBHOOK_URL'];
  const discordUrl = process.env['DISCORD_WEBHOOK_URL'];
  if (slackUrl) return new SlackNotifier(slackUrl);
  if (discordUrl) return new DiscordNotifier(discordUrl);
  return { notifyDraftReady: async () => {}, notifyPublishError: async () => {} };
}

export async function main(): Promise<void> {
  const devtoApiKey = process.env['DEVTO_API_KEY'];
  if (!devtoApiKey) {
    console.error('[publish-cli] DEVTO_API_KEY is not set.');
    process.exit(1);
  }

  const blogDir = process.env['BLOG_DIR'] ?? 'blog';
  const shortenerBaseUrl = process.env['SHORTENER_BASE_URL'];

  const draftRepo = new JsonlDraftRepository(DRAFTS_FILE);
  const approvalRepo = new JsonlApprovalRepository(APPROVALS_FILE);
  const postRepo = new JsonlPostRepository(POSTS_FILE);
  const notifier = buildNotifier();

  const devto = new DevToPublisher(devtoApiKey);
  const blog = new BlogPublisher(blogDir);
  const shortener = new URLShortenerClient(shortenerBaseUrl);
  const publisher = new Publisher(devto, blog, shortener, notifier);

  const drafts = await draftRepo.findAll();
  const approvals = await approvalRepo.findAll();

  const approvedDraftIds = new Set(
    approvals.filter((a) => a.action === 'approved').map((a) => a.draftId),
  );

  let published = 0;
  for (const draft of drafts) {
    if (!approvedDraftIds.has(draft.id)) continue;

    const approval = approvals.find((a) => a.draftId === draft.id && a.action === 'approved');
    const validTargets = new Set<string>(['devto', 'blog']);
    const targets = (approval?.targets ?? ['devto', 'blog']).filter(
      (t): t is PublishTarget => validTargets.has(t),
    );

    const posts = await publisher.publish(draft, targets, postRepo);
    published += posts.length;
    console.log(`[publish-cli] Published ${posts.length} post(s) for draft ${draft.id}`);
  }

  console.log(`[publish-cli] Done. Total posts created: ${published}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err: unknown) => {
    console.error('[publish-cli] Unexpected error:', err);
    process.exit(1);
  });
}
