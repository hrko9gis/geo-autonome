import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { EStatCollector } from './estat.js';
import { HackerNewsCollector } from './hackerNews.js';
import { HealthcheckNotifier, NoopHealthcheckNotifier } from './healthcheck.js';
import { LocalFileCollector } from './localFile.js';
import { PlateauFeedCollector } from './plateauFeed.js';
import { RedditCollector } from './reddit.js';
import { JsonlFileRepository } from './repository.js';
import { CollectorRunner } from './runner.js';
import type { CollectorSource } from './types.js';

const OUTPUT_FILE = path.join('data', 'collected_items.jsonl');

// Sources allowed to fail without failing the whole job. Reddit blocks
// datacenter/cloud IPs (e.g. GitHub Actions runners) with 403, so its failure
// in CI is expected and must not turn the workflow red.
const NON_CRITICAL_SOURCES: ReadonlySet<CollectorSource> = new Set<CollectorSource>([
  'reddit',
]);

export function buildHealthcheckUuids(): Partial<Record<CollectorSource, string>> {
  const raw = process.env['HEALTHCHECK_UUID_MAP'];
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Partial<Record<CollectorSource, string>>;
  } catch (err) {
    console.warn('[collect-cli] Invalid HEALTHCHECK_UUID_MAP, ignoring:', err);
    return {};
  }
}

export async function main(): Promise<void> {
  mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });

  const repository = new JsonlFileRepository(OUTPUT_FILE);

  const healthcheckBaseUrl = process.env['HEALTHCHECK_BASE_URL'];
  const notifier = healthcheckBaseUrl
    ? new HealthcheckNotifier(healthcheckBaseUrl)
    : new NoopHealthcheckNotifier();

  const healthcheckUuids = buildHealthcheckUuids();

  const collectors = [
    new HackerNewsCollector(),
    new RedditCollector(),
    new EStatCollector(),
    new PlateauFeedCollector(),
    new LocalFileCollector(),
  ];

  const runner = new CollectorRunner(collectors, repository, notifier, healthcheckUuids);
  const summary = await runner.run();

  console.log(
    `[collect-cli] Done. Total collected: ${summary.totalCollected}`,
  );
  for (const [source, stat] of Object.entries(summary.bySource)) {
    if (stat.failed) {
      if (NON_CRITICAL_SOURCES.has(source as CollectorSource)) {
        console.warn(`[collect-cli] WARN (non-critical): ${source}`);
      } else {
        console.error(`[collect-cli] FAILED: ${source}`);
      }
    } else if (stat.success > 0) {
      console.log(`[collect-cli] ${source}: ${stat.success} items`);
    }
  }

  const hasCriticalFailure = Object.entries(summary.bySource).some(
    ([source, stat]) => stat.failed && !NON_CRITICAL_SOURCES.has(source as CollectorSource),
  );
  if (hasCriticalFailure) {
    process.exit(2);
  }
}

// Run only when executed directly (not when imported in tests)
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err: unknown) => {
    console.error('[collect-cli] Unexpected error:', err);
    process.exit(1);
  });
}
