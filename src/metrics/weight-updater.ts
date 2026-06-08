import { writeFile } from 'node:fs/promises';
import type { MonthlyReport, ScoringWeights } from './types.js';

const BASE_WEIGHTS: Record<string, number> = {
  plateau: 90,
  estat: 70,
  hacker_news: 60,
  reddit: 50,
  local_file: 40,
};

const SALES_BONUS_PER_USD = 0.2;
const MAX_BONUS = 40;

export class ScoringWeightUpdater {
  async updateFromReport(
    report: MonthlyReport,
    weightsPath: string,
  ): Promise<ScoringWeights> {
    const potential: Record<string, number> = { ...BASE_WEIGHTS };

    for (const roi of report.sourceRoi) {
      const base = BASE_WEIGHTS[roi.source] ?? 50;
      const bonus = Math.min(roi.totalSalesUsd * SALES_BONUS_PER_USD, MAX_BONUS);
      potential[roi.source] = Math.min(Math.round(base + bonus), 100);
    }

    const weights: ScoringWeights = {
      potential,
      updatedAt: new Date(),
    };

    await writeFile(weightsPath, JSON.stringify(weights, null, 2), 'utf8');
    return weights;
  }
}
