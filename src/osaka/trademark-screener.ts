import { readFile } from 'node:fs/promises';
import path from 'node:path';

export type TrademarkStrategy = 'abstract' | 'rebrand' | 'delete';

export interface TrademarkPattern {
  keyword: string;
  strategy: TrademarkStrategy;
  replacement?: string;
  notes: string;
}

export interface ScreenResult {
  matched: boolean;
  filePath: string;
  pattern?: TrademarkPattern;
  strategy?: TrademarkStrategy;
}

export class TrademarkScreener {
  private patternsCache: TrademarkPattern[] | null = null;

  constructor(private readonly patternsPath: string) {}

  async loadPatterns(): Promise<TrademarkPattern[]> {
    if (this.patternsCache) return this.patternsCache;
    const content = await readFile(this.patternsPath, 'utf8');
    this.patternsCache = JSON.parse(content) as TrademarkPattern[];
    return this.patternsCache;
  }

  async screen(filePath: string): Promise<ScreenResult> {
    const patterns = await this.loadPatterns();
    const normalized = path.basename(filePath).toLowerCase().replace(/[_\-.\s]/g, '');

    for (const pattern of patterns) {
      const keyword = pattern.keyword.toLowerCase().replace(/[_\-.\s]/g, '');
      if (normalized.includes(keyword)) {
        return {
          matched: true,
          filePath,
          pattern,
          strategy: pattern.strategy,
        };
      }
    }

    return { matched: false, filePath };
  }

  async screenAll(filePaths: string[]): Promise<ScreenResult[]> {
    return Promise.all(filePaths.map((fp) => this.screen(fp)));
  }
}
