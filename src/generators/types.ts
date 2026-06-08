export interface DraftFrontmatter {
  title: string;
  description: string;
  tags: string[];
  published: boolean;
  cover_image?: string;
}

export type DraftStatus = 'pending' | 'approved' | 'rejected' | 'published';

export interface Draft {
  id: string;
  scoredItemId: string;
  frontmatter: DraftFrontmatter;
  contentMd: string;
  status: DraftStatus;
  createdAt: Date;
}
