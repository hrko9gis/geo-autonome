import { appendFile, readFile } from 'node:fs/promises';
import type { Approval } from './types.js';

export interface IApprovalRepository {
  save(approval: Approval): Promise<void>;
  findAll(): Promise<Approval[]>;
  findByDraftId(draftId: string): Promise<Approval[]>;
}

export class InMemoryApprovalRepository implements IApprovalRepository {
  private approvals: Approval[] = [];

  async save(approval: Approval): Promise<void> {
    this.approvals.push(approval);
  }

  async findAll(): Promise<Approval[]> {
    return [...this.approvals];
  }

  async findByDraftId(draftId: string): Promise<Approval[]> {
    return this.approvals.filter((a) => a.draftId === draftId);
  }
}

export class JsonlApprovalRepository implements IApprovalRepository {
  constructor(private readonly filePath: string) {}

  async save(approval: Approval): Promise<void> {
    await appendFile(this.filePath, JSON.stringify(approval) + '\n', 'utf8');
  }

  async findAll(): Promise<Approval[]> {
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
        const parsed = JSON.parse(line) as Approval & { approvedAt: string };
        return { ...parsed, approvedAt: new Date(parsed.approvedAt) };
      });
  }

  async findByDraftId(draftId: string): Promise<Approval[]> {
    const all = await this.findAll();
    return all.filter((a) => a.draftId === draftId);
  }
}
