import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { JsonlFileRepository } from '../collectors/repository.js';
import { AgentClientError, createAgentClient } from '../shared/client-factory.js';
import { ScoringEngine } from './scoring-engine.js';
import { JsonlScoredItemRepository } from './repository.js';
import { Summarizer } from './summarizer.js';

const INPUT_FILE = path.join('data', 'collected_items.jsonl');
const OUTPUT_FILE = path.join('data', 'scored_items.jsonl');

export async function main(): Promise<void> {
  mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });

  let client;
  try {
    client = createAgentClient();
  } catch (err) {
    if (err instanceof AgentClientError) {
      console.error(`[summarize-cli] Configuration error: ${err.message}`);
      process.exit(1);
    }
    throw err;
  }

  const engine = new ScoringEngine();
  const summarizer = new Summarizer(client, engine);

  const inputRepo = new JsonlFileRepository(INPUT_FILE);
  const outputRepo = new JsonlScoredItemRepository(OUTPUT_FILE);

  let items;
  try {
    items = await inputRepo.findAll();
  } catch (err) {
    console.error('[summarize-cli] Failed to read input file:', err);
    process.exit(2);
  }

  if (items.length === 0) {
    console.log('[summarize-cli] No items to process.');
    return;
  }

  let scored;
  try {
    scored = await summarizer.processBatch(items);
  } catch (err) {
    console.error('[summarize-cli] API error during summarization:', err);
    process.exit(2);
  }

  await outputRepo.saveAll(scored);

  const selectedCount = scored.filter((s) => s.selected).length;
  console.log(
    `[summarize-cli] ${scored.length} items scored. ${selectedCount} selected for draft generation.`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err: unknown) => {
    console.error('[summarize-cli] Unexpected error:', err);
    process.exit(1);
  });
}
