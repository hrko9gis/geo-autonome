import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryApprovalRepository } from '../../src/approval/repository.js';
import type { Approval } from '../../src/approval/types.js';

vi.mock('node:fs/promises', () => ({
  appendFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(''),
}));

function makeApproval(draftId = 'draft-1', action: Approval['action'] = 'approved'): Approval {
  return {
    id: crypto.randomUUID(),
    draftId,
    action,
    targets: action === 'approved' ? ['devto', 'blog'] : undefined,
    approvedAt: new Date('2026-05-29T10:00:00Z'),
  };
}

describe('InMemoryApprovalRepository', () => {
  it('save() stores an approval', async () => {
    const repo = new InMemoryApprovalRepository();
    const approval = makeApproval();
    await repo.save(approval);
    expect(await repo.findAll()).toHaveLength(1);
  });

  it('findAll() returns a copy (mutation safe)', async () => {
    const repo = new InMemoryApprovalRepository();
    await repo.save(makeApproval());
    const first = await repo.findAll();
    first.splice(0);
    expect(await repo.findAll()).toHaveLength(1);
  });

  it('findByDraftId() returns only matching approvals', async () => {
    const repo = new InMemoryApprovalRepository();
    await repo.save(makeApproval('draft-A', 'approved'));
    await repo.save(makeApproval('draft-B', 'rejected'));
    const result = await repo.findByDraftId('draft-A');
    expect(result).toHaveLength(1);
    expect(result[0].draftId).toBe('draft-A');
  });
});

describe('JsonlApprovalRepository', () => {
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
    const { JsonlApprovalRepository } = await import('../../src/approval/repository.js');
    const repo = new JsonlApprovalRepository('/tmp/approvals.jsonl');
    const approval = makeApproval();
    await repo.save(approval);
    expect(appendFileMock).toHaveBeenCalledOnce();
    const written = String(appendFileMock.mock.calls[0]?.[1] ?? '');
    expect(written).toContain(approval.id);
  });

  it('findAll() returns empty when file not found', async () => {
    readFileMock.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
    const { JsonlApprovalRepository } = await import('../../src/approval/repository.js');
    const repo = new JsonlApprovalRepository('/tmp/nonexistent.jsonl');
    expect(await repo.findAll()).toEqual([]);
  });

  it('findAll() parses JSONL and restores Date', async () => {
    const approval = makeApproval();
    readFileMock.mockResolvedValue(JSON.stringify(approval) + '\n');
    const { JsonlApprovalRepository } = await import('../../src/approval/repository.js');
    const repo = new JsonlApprovalRepository('/tmp/approvals.jsonl');
    const items = await repo.findAll();
    expect(items[0].approvedAt).toBeInstanceOf(Date);
  });
});
