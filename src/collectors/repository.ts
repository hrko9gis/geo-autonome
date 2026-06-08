import { appendFile, readFile } from 'node:fs/promises';
import type { CollectorSource, RawItem } from './types.js';

export interface IItemRepository {
  save(item: RawItem): Promise<void>;
  saveAll(items: RawItem[]): Promise<void>;
  findAll(): Promise<RawItem[]>;
  findBySource(source: CollectorSource): Promise<RawItem[]>;
}

export class InMemoryItemRepository implements IItemRepository {
  private items: RawItem[] = [];

  async save(item: RawItem): Promise<void> {
    this.items.push(item);
  }

  async saveAll(items: RawItem[]): Promise<void> {
    this.items.push(...items);
  }

  async findAll(): Promise<RawItem[]> {
    return [...this.items];
  }

  async findBySource(source: CollectorSource): Promise<RawItem[]> {
    return this.items.filter((item) => item.source === source);
  }
}

export class JsonlFileRepository implements IItemRepository {
  constructor(private readonly filePath: string) {}

  async save(item: RawItem): Promise<void> {
    await appendFile(this.filePath, JSON.stringify(item) + '\n', 'utf8');
  }

  async saveAll(items: RawItem[]): Promise<void> {
    if (items.length === 0) return;
    const lines = items.map((item) => JSON.stringify(item)).join('\n') + '\n';
    await appendFile(this.filePath, lines, 'utf8');
  }

  async findAll(): Promise<RawItem[]> {
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
        const parsed = JSON.parse(line) as RawItem & { collectedAt: string };
        return { ...parsed, collectedAt: new Date(parsed.collectedAt) };
      });
  }

  async findBySource(source: CollectorSource): Promise<RawItem[]> {
    const all = await this.findAll();
    return all.filter((item) => item.source === source);
  }
}
