import { appendFile, readFile } from 'node:fs/promises';
import type { ScoredItem } from './types.js';

export interface IScoredItemRepository {
  save(item: ScoredItem): Promise<void>;
  saveAll(items: ScoredItem[]): Promise<void>;
  findAll(): Promise<ScoredItem[]>;
  findBySelected(selected: boolean): Promise<ScoredItem[]>;
}

export class InMemoryScoredItemRepository implements IScoredItemRepository {
  private items: ScoredItem[] = [];

  async save(item: ScoredItem): Promise<void> {
    this.items.push(item);
  }

  async saveAll(items: ScoredItem[]): Promise<void> {
    this.items.push(...items);
  }

  async findAll(): Promise<ScoredItem[]> {
    return [...this.items];
  }

  async findBySelected(selected: boolean): Promise<ScoredItem[]> {
    return this.items.filter((item) => item.selected === selected);
  }
}

export class JsonlScoredItemRepository implements IScoredItemRepository {
  constructor(private readonly filePath: string) {}

  async save(item: ScoredItem): Promise<void> {
    await appendFile(this.filePath, JSON.stringify(item) + '\n', 'utf8');
  }

  async saveAll(items: ScoredItem[]): Promise<void> {
    if (items.length === 0) return;
    const lines = items.map((item) => JSON.stringify(item)).join('\n') + '\n';
    await appendFile(this.filePath, lines, 'utf8');
  }

  async findAll(): Promise<ScoredItem[]> {
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
        const parsed = JSON.parse(line) as ScoredItem & { scoredAt: string };
        return { ...parsed, scoredAt: new Date(parsed.scoredAt) };
      });
  }

  async findBySelected(selected: boolean): Promise<ScoredItem[]> {
    const all = await this.findAll();
    return all.filter((item) => item.selected === selected);
  }
}
