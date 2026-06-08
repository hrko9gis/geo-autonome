export type PublishTarget = 'devto' | 'blog';

export interface Post {
  id: string;
  draftId: string;
  platform: PublishTarget;
  externalUrl?: string;
  shortUrlId?: string;
  publishedAt: Date;
}
