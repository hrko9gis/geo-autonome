import { appendFile, readFile } from 'node:fs/promises';
import type { Sale } from './types.js';

export interface ISaleRepository {
  save(sale: Sale): Promise<void>;
  findAll(): Promise<Sale[]>;
  findByProductId(productId: string): Promise<Sale[]>;
}

export class InMemorySaleRepository implements ISaleRepository {
  private sales: Sale[] = [];

  async save(sale: Sale): Promise<void> {
    this.sales.push(sale);
  }

  async findAll(): Promise<Sale[]> {
    return [...this.sales];
  }

  async findByProductId(productId: string): Promise<Sale[]> {
    return this.sales.filter((s) => s.productId === productId);
  }
}

export class JsonlSaleRepository implements ISaleRepository {
  constructor(private readonly filePath: string) {}

  async save(sale: Sale): Promise<void> {
    await appendFile(this.filePath, JSON.stringify(sale) + '\n', 'utf8');
  }

  async findAll(): Promise<Sale[]> {
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
        const parsed = JSON.parse(line) as Sale & { soldAt: string };
        return { ...parsed, soldAt: new Date(parsed.soldAt) };
      });
  }

  async findByProductId(productId: string): Promise<Sale[]> {
    const all = await this.findAll();
    return all.filter((s) => s.productId === productId);
  }
}
