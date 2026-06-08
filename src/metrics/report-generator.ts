import type { IPostRepository } from '../publisher/repository.js';
import type { Post } from '../publisher/types.js';
import type { ISaleRepository } from '../sales/repository.js';
import type { Sale } from '../sales/types.js';
import type { IClickRepository } from './click-repository.js';
import type { Click } from './types.js';
import type {
  MonthlyReport,
  ProductROI,
  SourceROI,
  TopShortUrl,
} from './types.js';

function isInMonth(date: Date, year: number, month: number): boolean {
  return date.getFullYear() === year && date.getMonth() + 1 === month;
}

export class ReportGenerator {
  constructor(
    private readonly saleRepo: ISaleRepository,
    private readonly clickRepo: IClickRepository,
    private readonly postRepo: IPostRepository,
  ) {}

  async generateMonthly(year: number, month: number): Promise<MonthlyReport> {
    const [allSales, allClicks, allPosts] = await Promise.all([
      this.saleRepo.findAll(),
      this.clickRepo.findAll(),
      this.postRepo.findAll(),
    ]);

    const sales = allSales.filter((s) => isInMonth(s.soldAt, year, month));
    const clicks = allClicks.filter((c) => isInMonth(c.clickedAt, year, month));
    const posts = allPosts.filter((p) => isInMonth(p.publishedAt, year, month));

    return {
      year,
      month,
      generatedAt: new Date(),
      sourceRoi: this.calcSourceRoi(sales, clicks, posts),
      topicRoi: [],
      productRoi: this.calcProductRoi(sales, clicks),
      topShortUrls: this.calcTopShortUrls(clicks, sales),
    };
  }

  private calcSourceRoi(sales: Sale[], clicks: Click[], posts: Post[]): SourceROI[] {
    // Build index: shortUrlId → post for O(1) lookup
    const shortUrlToPost = new Map<string, Post>();
    for (const post of posts) {
      if (post.shortUrlId) {
        shortUrlToPost.set(post.shortUrlId, post);
      }
    }

    const sourceMap = new Map<string, { clicks: number; salesUsd: number; articleCount: number }>();

    for (const post of posts) {
      const platform = post.platform;
      const entry = sourceMap.get(platform) ?? { clicks: 0, salesUsd: 0, articleCount: 0 };
      entry.articleCount++;
      sourceMap.set(platform, entry);
    }

    for (const click of clicks) {
      const matchedPost = shortUrlToPost.get(click.shortUrlId);
      if (matchedPost) {
        const platform = matchedPost.platform;
        const e = sourceMap.get(platform) ?? { clicks: 0, salesUsd: 0, articleCount: 0 };
        e.clicks++;
        sourceMap.set(platform, e);
      }
    }

    for (const sale of sales) {
      if (sale.shortUrlId) {
        const matchedPost = shortUrlToPost.get(sale.shortUrlId);
        if (matchedPost) {
          const platform = matchedPost.platform;
          const e = sourceMap.get(platform) ?? { clicks: 0, salesUsd: 0, articleCount: 0 };
          e.salesUsd += sale.amountUsd;
          sourceMap.set(platform, e);
        }
      }
    }

    return [...sourceMap.entries()].map(([source, data]) => ({
      source,
      totalClicks: data.clicks,
      totalSalesUsd: data.salesUsd,
      articleCount: data.articleCount,
    }));
  }

  private calcProductRoi(sales: Sale[], clicks: Click[]): ProductROI[] {
    const productMap = new Map<string, ProductROI>();

    for (const sale of sales) {
      const key = `${sale.platform}:${sale.productId}`;
      const entry = productMap.get(key) ?? {
        productId: sale.productId,
        platform: sale.platform,
        totalSalesUsd: 0,
        saleCount: 0,
        shortUrlClicks: 0,
      };
      entry.totalSalesUsd += sale.amountUsd;
      entry.saleCount++;
      productMap.set(key, entry);
    }

    const shortUrlToSales = new Map<string, string[]>();
    for (const sale of sales) {
      if (sale.shortUrlId) {
        const key = `${sale.platform}:${sale.productId}`;
        const list = shortUrlToSales.get(sale.shortUrlId) ?? [];
        list.push(key);
        shortUrlToSales.set(sale.shortUrlId, list);
      }
    }

    for (const click of clicks) {
      const keys = shortUrlToSales.get(click.shortUrlId);
      if (keys) {
        for (const key of keys) {
          const entry = productMap.get(key);
          if (entry) {
            entry.shortUrlClicks++;
          }
        }
      }
    }

    return [...productMap.values()];
  }

  private calcTopShortUrls(clicks: Click[], sales: Sale[], limit = 10): TopShortUrl[] {
    const clickCountMap = new Map<string, number>();
    for (const click of clicks) {
      clickCountMap.set(click.shortUrlId, (clickCountMap.get(click.shortUrlId) ?? 0) + 1);
    }

    const salesMap = new Map<string, number>();
    for (const sale of sales) {
      if (sale.shortUrlId) {
        salesMap.set(sale.shortUrlId, (salesMap.get(sale.shortUrlId) ?? 0) + sale.amountUsd);
      }
    }

    const allShortUrls = new Set([...clickCountMap.keys(), ...salesMap.keys()]);
    const result: TopShortUrl[] = [...allShortUrls].map((id) => ({
      shortUrlId: id,
      clicks: clickCountMap.get(id) ?? 0,
      salesUsd: salesMap.get(id) ?? 0,
    }));

    return result.sort((a, b) => b.clicks - a.clicks).slice(0, limit);
  }
}
