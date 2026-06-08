import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScoringWeightUpdater } from '../../src/metrics/weight-updater.js';
import type { MonthlyReport } from '../../src/metrics/types.js';

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(''),
}));

function makeReport(overrides: Partial<MonthlyReport> = {}): MonthlyReport {
  return {
    year: 2026,
    month: 5,
    generatedAt: new Date(),
    sourceRoi: [],
    productRoi: [],
    topShortUrls: [],
    ...overrides,
  };
}

describe('ScoringWeightUpdater', () => {
  afterEach(() => vi.clearAllMocks());

  it('returns a ScoringWeights object with updatedAt as Date', async () => {
    const { writeFile } = await import('node:fs/promises');
    (writeFile as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const updater = new ScoringWeightUpdater();
    const report = makeReport();
    const weights = await updater.updateFromReport(report, '/tmp/weights.json');

    expect(weights.updatedAt).toBeInstanceOf(Date);
    expect(weights.potential).toBeDefined();
  });

  it('writes the weights to the specified path', async () => {
    const { writeFile } = await import('node:fs/promises');
    const writeSpy = writeFile as ReturnType<typeof vi.fn>;
    writeSpy.mockResolvedValue(undefined);

    const updater = new ScoringWeightUpdater();
    await updater.updateFromReport(makeReport(), '/tmp/scoring_weights.json');

    expect(writeSpy).toHaveBeenCalledWith(
      '/tmp/scoring_weights.json',
      expect.any(String),
      'utf8',
    );
  });

  it('increases potential score for sources with sales', async () => {
    const { writeFile } = await import('node:fs/promises');
    (writeFile as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const updater = new ScoringWeightUpdater();
    const report = makeReport({
      sourceRoi: [{ source: 'hacker_news', totalClicks: 100, totalSalesUsd: 50, articleCount: 5 }],
    });
    const weights = await updater.updateFromReport(report, '/tmp/weights.json');

    // Base for hacker_news = 60, bonus = min(50 * 0.2, 40) = 10 → 70
    expect(weights.potential['hacker_news']).toBeGreaterThan(60);
  });

  it('caps potential score at 100', async () => {
    const { writeFile } = await import('node:fs/promises');
    (writeFile as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const updater = new ScoringWeightUpdater();
    const report = makeReport({
      sourceRoi: [{ source: 'plateau', totalClicks: 100, totalSalesUsd: 1000, articleCount: 10 }],
    });
    const weights = await updater.updateFromReport(report, '/tmp/weights.json');

    expect(weights.potential['plateau']).toBeLessThanOrEqual(100);
  });

  it('keeps base weights for sources with no sales', async () => {
    const { writeFile } = await import('node:fs/promises');
    (writeFile as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const updater = new ScoringWeightUpdater();
    const weights = await updater.updateFromReport(makeReport(), '/tmp/weights.json');

    expect(weights.potential['plateau']).toBe(90);
    expect(weights.potential['hacker_news']).toBe(60);
  });
});
