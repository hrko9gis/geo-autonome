import { appendFile, readFile } from 'node:fs/promises';
import type { Draft, DraftStatus } from './types.js';

export interface IDraftRepository {
  save(draft: Draft): Promise<void>;
  saveAll(drafts: Draft[]): Promise<void>;
  findAll(): Promise<Draft[]>;
  findByStatus(status: DraftStatus): Promise<Draft[]>;
}

export class InMemoryDraftRepository implements IDraftRepository {
  private drafts: Draft[] = [];

  async save(draft: Draft): Promise<void> {
    this.drafts.push(draft);
  }

  async saveAll(drafts: Draft[]): Promise<void> {
    this.drafts.push(...drafts);
  }

  async findAll(): Promise<Draft[]> {
    return [...this.drafts];
  }

  async findByStatus(status: DraftStatus): Promise<Draft[]> {
    return this.drafts.filter((d) => d.status === status);
  }
}

export class JsonlDraftRepository implements IDraftRepository {
  constructor(private readonly filePath: string) {}

  async save(draft: Draft): Promise<void> {
    await appendFile(this.filePath, JSON.stringify(draft) + '\n', 'utf8');
  }

  async saveAll(drafts: Draft[]): Promise<void> {
    if (drafts.length === 0) return;
    const lines = drafts.map((d) => JSON.stringify(d)).join('\n') + '\n';
    await appendFile(this.filePath, lines, 'utf8');
  }

  async findAll(): Promise<Draft[]> {
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
        const parsed = JSON.parse(line) as Draft & { createdAt: string };
        return { ...parsed, createdAt: new Date(parsed.createdAt) };
      });
  }

  async findByStatus(status: DraftStatus): Promise<Draft[]> {
    const all = await this.findAll();
    return all.filter((d) => d.status === status);
  }
}
