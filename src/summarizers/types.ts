import type { CollectorSource } from '../collectors/types.js';

export type { CollectorSource };

export interface ScoredItem {
  id: string;
  rawItemId: string;
  source: CollectorSource;
  title?: string;
  url?: string;
  summaryEn: string;
  relevanceScore: number;
  noveltyScore: number;
  potentialScore: number;
  totalScore: number;
  selected: boolean;
  scoredAt: Date;
}
