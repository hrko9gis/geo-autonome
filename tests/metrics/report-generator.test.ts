import { describe, expect, it } from 'vitest';
import { ReportGenerator } from '../../src/metrics/report-generator.js';
import { InMemoryClickRepository } from '../../src/metrics/click-repository.js';
import { InMemoryPostRepository } from '../../src/publisher/repository.js';
import { InMemorySaleRepository } from '../../src/sales/repository.js';
import type { Click } from '../../src/metrics/types.js';
import type { Post } from '../../src/publisher/types.js';
import type { Sale } from '../../src/sales/types.js';

const MAY2026 = { year: 2026, month: 5 };

function makeClick(shortUrlId: string, month = 5): Click {
  return {
    id: crypto.randomUUID(),
    shortUrlId,
    clickedAt: new Date(`2026-${String(month).padStart(2, '0')}-15T10:00:00Z`),
  };
}

function makePost(id: string, platform: Post['platform'] = 'devto', month = 5): Post {
  return {
    id,
    draftId: 'draft-1',
    platform,
    externalUrl: `https://dev.to/user/${id}`,
    publishedAt: new Date(`2026-${String(month).padStart(2, '0')}-10T10:00:00Z`),
  };
}

function makeSale(productId: string, amountUsd: number, shortUrlId?: string, month = 5): Sale {
  return {
    id: crypto.randomUUID(),
    productId,
    platform: 'gumroad',
    amountUsd,
    currency: 'USD',
    shortUrlId,
    soldAt: new Date(`2026-${String(month).padStart(2, '0')}-20T10:00:00Z`),
  };
}

describe('ReportGenerator', () => {
  it('generates an empty report when no data exists', async () => {
    const gen = new ReportGenerator(
      new InMemorySaleRepository(),
      new InMemoryClickRepository(),
      new InMemoryPostRepository(),
    );
    const report = await gen.generateMonthly(MAY2026.year, MAY2026.month);
    expect(report.year).toBe(2026);
    expect(report.month).toBe(5);
    expect(report.sourceRoi).toHaveLength(0);
    expect(report.productRoi).toHaveLength(0);
    expect(report.topShortUrls).toHaveLength(0);
    expect(report.generatedAt).toBeInstanceOf(Date);
  });

  it('filters out data from other months', async () => {
    const saleRepo = new InMemorySaleRepository();
    const clickRepo = new InMemoryClickRepository();
    const postRepo = new InMemoryPostRepository();

    await saleRepo.save(makeSale('prod-1', 19, undefined, 4)); // April — should be excluded
    await clickRepo.save(makeClick('url-1', 4)); // April — excluded

    const gen = new ReportGenerator(saleRepo, clickRepo, postRepo);
    const report = await gen.generateMonthly(MAY2026.year, MAY2026.month);

    expect(report.productRoi).toHaveLength(0);
    expect(report.topShortUrls).toHaveLength(0);
  });

  it('calculates ProductROI from sales data', async () => {
    const saleRepo = new InMemorySaleRepository();
    const clickRepo = new InMemoryClickRepository();
    const postRepo = new InMemoryPostRepository();

    await saleRepo.save(makeSale('template-japan', 19));
    await saleRepo.save(makeSale('template-japan', 19));

    const gen = new ReportGenerator(saleRepo, clickRepo, postRepo);
    const report = await gen.generateMonthly(MAY2026.year, MAY2026.month);

    expect(report.productRoi).toHaveLength(1);
    expect(report.productRoi[0].productId).toBe('template-japan');
    expect(report.productRoi[0].totalSalesUsd).toBe(38);
    expect(report.productRoi[0].saleCount).toBe(2);
  });

  it('populates topShortUrls sorted by click count', async () => {
    const saleRepo = new InMemorySaleRepository();
    const clickRepo = new InMemoryClickRepository();
    const postRepo = new InMemoryPostRepository();

    await clickRepo.saveAll([
      makeClick('url-A'), makeClick('url-A'), makeClick('url-A'),
      makeClick('url-B'),
    ]);

    const gen = new ReportGenerator(saleRepo, clickRepo, postRepo);
    const report = await gen.generateMonthly(MAY2026.year, MAY2026.month);

    expect(report.topShortUrls[0].shortUrlId).toBe('url-A');
    expect(report.topShortUrls[0].clicks).toBe(3);
    expect(report.topShortUrls[1].shortUrlId).toBe('url-B');
  });

  it('associates sales with topShortUrls', async () => {
    const saleRepo = new InMemorySaleRepository();
    const clickRepo = new InMemoryClickRepository();
    const postRepo = new InMemoryPostRepository();

    await saleRepo.save(makeSale('prod-1', 19, 'url-tracked'));
    await clickRepo.save(makeClick('url-tracked'));

    const gen = new ReportGenerator(saleRepo, clickRepo, postRepo);
    const report = await gen.generateMonthly(MAY2026.year, MAY2026.month);

    const entry = report.topShortUrls.find((t) => t.shortUrlId === 'url-tracked');
    expect(entry).toBeDefined();
    expect(entry?.salesUsd).toBe(19);
    expect(entry?.clicks).toBe(1);
  });

  it('includes posts in sourceRoi calculation', async () => {
    const saleRepo = new InMemorySaleRepository();
    const clickRepo = new InMemoryClickRepository();
    const postRepo = new InMemoryPostRepository();

    await postRepo.save(makePost('post-1', 'devto'));
    await postRepo.save(makePost('post-2', 'devto'));

    const gen = new ReportGenerator(saleRepo, clickRepo, postRepo);
    const report = await gen.generateMonthly(MAY2026.year, MAY2026.month);

    const devtoRoi = report.sourceRoi.find((r) => r.source === 'devto');
    expect(devtoRoi?.articleCount).toBe(2);
  });
});
