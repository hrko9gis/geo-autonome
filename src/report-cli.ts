import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { JsonlPostRepository } from './publisher/repository.js';
import { JsonlSaleRepository } from './sales/repository.js';
import { JsonlClickRepository } from './metrics/click-repository.js';
import { ReportGenerator } from './metrics/report-generator.js';
import { ScoringWeightUpdater } from './metrics/weight-updater.js';

const SALES_FILE = path.join('data', 'sales.jsonl');
const CLICKS_FILE = path.join('data', 'clicks.jsonl');
const POSTS_FILE = path.join('data', 'posts.jsonl');
const REPORTS_DIR = path.join('data', 'reports');
const WEIGHTS_FILE = path.join('data', 'scoring_weights.json');

function parseArgs(): { year: number; month: number } {
  const args = process.argv.slice(2);
  const yearArg = args[args.indexOf('--year') + 1];
  const monthArg = args[args.indexOf('--month') + 1];

  if (yearArg && monthArg) {
    return { year: parseInt(yearArg, 10), month: parseInt(monthArg, 10) };
  }

  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return { year: prevMonth.getFullYear(), month: prevMonth.getMonth() + 1 };
}

export async function main(): Promise<void> {
  const { year, month } = parseArgs();

  const saleRepo = new JsonlSaleRepository(SALES_FILE);
  const clickRepo = new JsonlClickRepository(CLICKS_FILE);
  const postRepo = new JsonlPostRepository(POSTS_FILE);

  const generator = new ReportGenerator(saleRepo, clickRepo, postRepo);
  const report = await generator.generateMonthly(year, month);

  await mkdir(REPORTS_DIR, { recursive: true });
  const reportFile = path.join(REPORTS_DIR, `${year}-${String(month).padStart(2, '0')}.json`);
  await writeFile(reportFile, JSON.stringify(report, null, 2), 'utf8');
  console.log(`[report-cli] Report saved to ${reportFile}`);

  const updater = new ScoringWeightUpdater();
  const weights = await updater.updateFromReport(report, WEIGHTS_FILE);
  console.log(`[report-cli] Scoring weights updated at ${WEIGHTS_FILE}`);
  console.log(`[report-cli] Sources: ${Object.keys(weights.potential).join(', ')}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err: unknown) => {
    console.error('[report-cli] Unexpected error:', err);
    process.exit(1);
  });
}
