import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const MOCK_DRAFT_MD = `---
title: PLATEAU 3D City Guide
description: A guide for developers
tags: [geospatial, japan, 3d]
published: false
---

# Content here
`;

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: MOCK_DRAFT_MD }],
      }),
    },
  })),
}));

vi.mock('node:fs', () => ({ mkdirSync: vi.fn() }));

vi.mock('node:fs/promises', () => ({
  appendFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(''),
}));

describe('draft-cli main()', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((_code) => {
      throw new Error(`process.exit(${_code ?? 'undefined'})`);
    });
  });

  afterEach(() => {
    exitSpy.mockRestore();
    delete process.env['ANTHROPIC_API_KEY'];
    vi.clearAllMocks();
  });

  it('calls process.exit(1) when ANTHROPIC_API_KEY is not set', async () => {
    delete process.env['ANTHROPIC_API_KEY'];
    const { main } = await import('../../src/generators/draft-cli.js');

    await expect(main()).rejects.toThrow('process.exit(1)');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('does not call process.exit when API key is set and no selected items exist', async () => {
    process.env['ANTHROPIC_API_KEY'] = 'sk-test-key';
    const { main } = await import('../../src/generators/draft-cli.js');

    await expect(main()).resolves.toBeUndefined();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('generates and saves drafts when selected items are present', async () => {
    process.env['ANTHROPIC_API_KEY'] = 'sk-test-key';

    const fakeScoredItem = JSON.stringify({
      id: 'scored-1',
      rawItemId: 'raw-1',
      source: 'plateau',
      title: 'PLATEAU release',
      summaryEn: 'New geospatial data',
      relevanceScore: 90,
      noveltyScore: 70,
      potentialScore: 90,
      totalScore: 84.5,
      selected: true,
      scoredAt: new Date().toISOString(),
    });

    const { readFile, appendFile } = await import('node:fs/promises');
    (readFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce(fakeScoredItem + '\n');

    const { main } = await import('../../src/generators/draft-cli.js');
    await main();

    expect(appendFile).toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('generates drafts gracefully even when all API calls fail (generateBatch uses allSettled)', async () => {
    process.env['ANTHROPIC_API_KEY'] = 'sk-test-key';

    const fakeScoredItem = JSON.stringify({
      id: 'scored-fail',
      rawItemId: 'raw-fail',
      source: 'plateau',
      title: 'Failure test',
      summaryEn: 'Will fail',
      relevanceScore: 90,
      noveltyScore: 70,
      potentialScore: 90,
      totalScore: 84.5,
      selected: true,
      scoredAt: new Date().toISOString(),
    });

    const { readFile } = await import('node:fs/promises');
    (readFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce(fakeScoredItem + '\n');

    const { default: AnthropicMock } = await import('@anthropic-ai/sdk');
    (AnthropicMock as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
      messages: {
        create: vi.fn().mockRejectedValue(new Error('Overloaded')),
      },
    }));

    const { main } = await import('../../src/generators/draft-cli.js');
    // generateBatch uses Promise.allSettled — failures are swallowed, returns empty array
    await expect(main()).resolves.toBeUndefined();
    expect(exitSpy).not.toHaveBeenCalled();
  });
});
