import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemorySaleRepository } from '../../src/sales/repository.js';
import type { Sale } from '../../src/sales/types.js';

vi.mock('node:fs/promises', () => ({
  appendFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(''),
}));

function makeSale(productId = 'prod-1', shortUrlId?: string): Sale {
  return {
    id: crypto.randomUUID(),
    productId,
    platform: 'gumroad',
    amountUsd: 19,
    currency: 'USD',
    shortUrlId,
    soldAt: new Date('2026-05-30T10:00:00Z'),
  };
}

describe('InMemorySaleRepository', () => {
  it('save() stores a sale', async () => {
    const repo = new InMemorySaleRepository();
    await repo.save(makeSale());
    expect(await repo.findAll()).toHaveLength(1);
  });

  it('findAll() returns a copy (mutation safe)', async () => {
    const repo = new InMemorySaleRepository();
    await repo.save(makeSale());
    const first = await repo.findAll();
    first.splice(0);
    expect(await repo.findAll()).toHaveLength(1);
  });

  it('findByProductId() returns only matching sales', async () => {
    const repo = new InMemorySaleRepository();
    await repo.save(makeSale('prod-A'));
    await repo.save(makeSale('prod-B'));
    const result = await repo.findByProductId('prod-A');
    expect(result).toHaveLength(1);
    expect(result[0].productId).toBe('prod-A');
  });
});

describe('JsonlSaleRepository', () => {
  let appendFileMock: ReturnType<typeof vi.fn>;
  let readFileMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const fs = await import('node:fs/promises');
    appendFileMock = fs.appendFile as ReturnType<typeof vi.fn>;
    readFileMock = fs.readFile as ReturnType<typeof vi.fn>;
    appendFileMock.mockClear();
    readFileMock.mockClear();
    appendFileMock.mockResolvedValue(undefined);
    readFileMock.mockResolvedValue('');
  });

  afterEach(() => vi.clearAllMocks());

  it('save() appends JSONL line', async () => {
    const { JsonlSaleRepository } = await import('../../src/sales/repository.js');
    const repo = new JsonlSaleRepository('/tmp/sales.jsonl');
    const sale = makeSale();
    await repo.save(sale);
    expect(appendFileMock).toHaveBeenCalledOnce();
    const written = String(appendFileMock.mock.calls[0]?.[1] ?? '');
    expect(written).toContain(sale.id);
  });

  it('findAll() returns empty when file not found', async () => {
    readFileMock.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
    const { JsonlSaleRepository } = await import('../../src/sales/repository.js');
    const repo = new JsonlSaleRepository('/tmp/nonexistent.jsonl');
    expect(await repo.findAll()).toEqual([]);
  });

  it('findAll() parses JSONL and restores Date', async () => {
    const sale = makeSale();
    readFileMock.mockResolvedValue(JSON.stringify(sale) + '\n');
    const { JsonlSaleRepository } = await import('../../src/sales/repository.js');
    const repo = new JsonlSaleRepository('/tmp/sales.jsonl');
    const sales = await repo.findAll();
    expect(sales[0].soldAt).toBeInstanceOf(Date);
  });
});
