import { appendFile, readFile } from 'node:fs/promises';
import type { Post } from './types.js';

export interface IPostRepository {
  save(post: Post): Promise<void>;
  findAll(): Promise<Post[]>;
  findByDraftId(draftId: string): Promise<Post[]>;
}

export class InMemoryPostRepository implements IPostRepository {
  private posts: Post[] = [];

  async save(post: Post): Promise<void> {
    this.posts.push(post);
  }

  async findAll(): Promise<Post[]> {
    return [...this.posts];
  }

  async findByDraftId(draftId: string): Promise<Post[]> {
    return this.posts.filter((p) => p.draftId === draftId);
  }
}

export class JsonlPostRepository implements IPostRepository {
  constructor(private readonly filePath: string) {}

  async save(post: Post): Promise<void> {
    await appendFile(this.filePath, JSON.stringify(post) + '\n', 'utf8');
  }

  async findAll(): Promise<Post[]> {
    let content: string;
    try {
      content = await readFile(this.filePath, 'utf8');
    } catch {
      return [];
    }

    return content
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => {
        const parsed = JSON.parse(line) as Post & { publishedAt: string };
        return { ...parsed, publishedAt: new Date(parsed.publishedAt) };
      });
  }

  async findByDraftId(draftId: string): Promise<Post[]> {
    const all = await this.findAll();
    return all.filter((p) => p.draftId === draftId);
  }
}
