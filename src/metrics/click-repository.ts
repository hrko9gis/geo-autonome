import { appendFile, readFile } from 'node:fs/promises';
import type { Click } from './types.js';

export interface IClickRepository {
  save(click: Click): Promise<void>;
  saveAll(clicks: Click[]): Promise<void>;
  findAll(): Promise<Click[]>;
  findByShortUrlId(shortUrlId: string): Promise<Click[]>;
  countByShortUrlId(shortUrlId: string): Promise<number>;
}

export class InMemoryClickRepository implements IClickRepository {
  private clicks: Click[] = [];

  async save(click: Click): Promise<void> {
    this.clicks.push(click);
  }

  async saveAll(clicks: Click[]): Promise<void> {
    this.clicks.push(...clicks);
  }

  async findAll(): Promise<Click[]> {
    return [...this.clicks];
  }

  async findByShortUrlId(shortUrlId: string): Promise<Click[]> {
    return this.clicks.filter((c) => c.shortUrlId === shortUrlId);
  }

  async countByShortUrlId(shortUrlId: string): Promise<number> {
    return this.clicks.filter((c) => c.shortUrlId === shortUrlId).length;
  }
}

export class JsonlClickRepository implements IClickRepository {
  constructor(private readonly filePath: string) {}

  async save(click: Click): Promise<void> {
    await appendFile(this.filePath, JSON.stringify(click) + '\n', 'utf8');
  }

  async saveAll(clicks: Click[]): Promise<void> {
    if (clicks.length === 0) return;
    const lines = clicks.map((c) => JSON.stringify(c)).join('\n') + '\n';
    await appendFile(this.filePath, lines, 'utf8');
  }

  async findAll(): Promise<Click[]> {
    let content: string;
    try {
      content = await readFile(this.filePath, 'utf8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }

    return content
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => {
        const parsed = JSON.parse(line) as Click & { clickedAt: string };
        return { ...parsed, clickedAt: new Date(parsed.clickedAt) };
      });
  }

  async findByShortUrlId(shortUrlId: string): Promise<Click[]> {
    const all = await this.findAll();
    return all.filter((c) => c.shortUrlId === shortUrlId);
  }

  async countByShortUrlId(shortUrlId: string): Promise<number> {
    const filtered = await this.findByShortUrlId(shortUrlId);
    return filtered.length;
  }
}
