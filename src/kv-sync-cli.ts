import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { JsonlClickRepository } from './metrics/click-repository.js';
import type { Click } from './metrics/types.js';

const KV_CLICKS_FILE = path.join('data', 'kv_clicks.json');
const CLICKS_OUTPUT_FILE = path.join('data', 'clicks.jsonl');

interface KvClickEntry {
  shortUrlId: string;
  clickedAt: string;
  country?: string;
}

export async function main(): Promise<void> {
  let raw: string;
  try {
    raw = await readFile(KV_CLICKS_FILE, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      console.warn(`[kv-sync-cli] ${KV_CLICKS_FILE} not found. Nothing to sync.`);
      return;
    }
    throw err;
  }

  let entries: KvClickEntry[];
  try {
    entries = JSON.parse(raw) as KvClickEntry[];
  } catch {
    console.error('[kv-sync-cli] Failed to parse kv_clicks.json as JSON array.');
    process.exit(1);
  }

  const clicks: Click[] = entries.map((e) => ({
    id: crypto.randomUUID(),
    shortUrlId: e.shortUrlId,
    clickedAt: new Date(e.clickedAt),
    country: e.country,
  }));

  const repo = new JsonlClickRepository(CLICKS_OUTPUT_FILE);
  await repo.saveAll(clicks);

  console.log(`[kv-sync-cli] Synced ${clicks.length} click(s) to ${CLICKS_OUTPUT_FILE}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err: unknown) => {
    console.error('[kv-sync-cli] Unexpected error:', err);
    process.exit(1);
  });
}
