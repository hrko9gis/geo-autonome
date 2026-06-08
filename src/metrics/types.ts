export interface Click {
  id: string;
  shortUrlId: string;
  clickedAt: Date;
  country?: string;
}

export interface SourceROI {
  source: string;
  totalClicks: number;
  totalSalesUsd: number;
  articleCount: number;
}

export interface ProductROI {
  productId: string;
  platform: string;
  totalSalesUsd: number;
  saleCount: number;
  shortUrlClicks: number;
}

export interface TopShortUrl {
  shortUrlId: string;
  clicks: number;
  salesUsd: number;
}

export interface TopicROI {
  keyword: string;
  totalClicks: number;
  totalSalesUsd: number;
  articleCount: number;
}

export interface MonthlyReport {
  year: number;
  month: number;
  generatedAt: Date;
  sourceRoi: SourceROI[];
  topicRoi: TopicROI[];
  productRoi: ProductROI[];
  topShortUrls: TopShortUrl[];
}

export interface ScoringWeights {
  potential: Record<string, number>;
  updatedAt: Date;
}
