import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { AgentClientError, createAgentClient } from '../shared/client-factory.js';
import { JsonlScoredItemRepository } from '../summarizers/repository.js';
import { DraftGenerator } from './draft-generator.js';
import { JsonlDraftRepository } from './repository.js';

const INPUT_FILE = path.join('data', 'scored_items.jsonl');
const OUTPUT_FILE = path.join('data', 'drafts.jsonl');
const DAILY_DRAFT_COUNT = 2;

export async function main(): Promise<void> {
  mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });

  let client;
  try {
    client = createAgentClient();
  } catch (err) {
    if (err instanceof AgentClientError) {
      console.error(`[draft-cli] Configuration error: ${err.message}`);
      process.exit(1);
    }
    throw err;
  }

  const generator = new DraftGenerator(client);

  const inputRepo = new JsonlScoredItemRepository(INPUT_FILE);
  const outputRepo = new JsonlDraftRepository(OUTPUT_FILE);

  let selectedItems;
  try {
    selectedItems = await inputRepo.findBySelected(true);
  } catch (err) {
    console.error('[draft-cli] Failed to read scored items:', err);
    process.exit(2);
  }

  if (selectedItems.length === 0) {
    console.log('[draft-cli] No selected items to generate drafts for.');
    return;
  }

  let drafts;
  try {
    drafts = await generator.generateBatch(selectedItems, DAILY_DRAFT_COUNT);
  } catch (err) {
    console.error('[draft-cli] API error during draft generation:', err);
    process.exit(2);
  }

  await outputRepo.saveAll(drafts);

  console.log(`[draft-cli] ${drafts.length} drafts generated and saved to ${OUTPUT_FILE}.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err: unknown) => {
    console.error('[draft-cli] Unexpected error:', err);
    process.exit(1);
  });
}
