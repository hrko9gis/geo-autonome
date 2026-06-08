export type SalePlatform = 'gumroad' | 'fab' | 'sketchfab' | 'stripe';

export interface Sale {
  id: string;
  productId: string;
  platform: SalePlatform;
  amountUsd: number;
  currency: string;
  shortUrlId?: string;
  soldAt: Date;
}
