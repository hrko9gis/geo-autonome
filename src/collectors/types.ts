export type CollectorSource =
  | 'hacker_news'
  | 'reddit'
  | 'estat'
  | 'plateau'
  | 'local_file';

export interface RawItem {
  id: string;
  source: CollectorSource;
  externalId?: string;
  title?: string;
  url?: string;
  content?: string;
  rawData?: unknown;
  collectedAt: Date;
}

export interface CollectionSummary {
  totalCollected: number;
  bySource: Record<CollectorSource, { success: number; failed: boolean }>;
}
