import { afterEach, describe, expect, it, vi } from 'vitest';
import { Summarizer } from '../../src/summarizers/summarizer.js';
import type { IAnthropicClient } from '../../src/summarizers/summarizer.js';
import { ScoringEngine } from '../../src/summarizers/scoring-engine.js';
import type { RawItem } from '../../src/collectors/types.js';

function makeClient(text = 'Geospatial summary about Japan 3D city models.'): IAnthropicClient {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text }],
      }),
    },
  };
}

function makeItem(override: Partial<RawItem> = {}): RawItem {
  return {
    id: crypto.randomUUID(),
    source: 'hacker_news',
    title: 'PLATEAU 3D city model released',
    url: 'https://example.com/plateau',
    content: 'New geospatial data for GIS visualization',
    collectedAt: new Date(),
    ...override,
  };
}

describe('Summarizer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a ScoredItem from a RawItem', async () => {
    const client = makeClient();
    const summarizer = new Summarizer(client, new ScoringEngine());
    const item = makeItem();

    const result = await summarizer.summarize(item);

    expect(result.rawItemId).toBe(item.id);
    expect(result.source).toBe('hacker_news');
    expect(result.summaryEn).toContain('Geospatial');
    expect(result.scoredAt).toBeInstanceOf(Date);
    expect(result.id).toBeTruthy();
  });

  it('calls Haiku 4.5 model', async () => {
    const client = makeClient();
    const summarizer = new Summarizer(client, new ScoringEngine());

    await summarizer.summarize(makeItem());

    expect(client.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-haiku-4-5' }),
    );
  });

  it('propagates API errors from the client', async () => {
    const client: IAnthropicClient = {
      messages: {
        create: vi.fn().mockRejectedValue(new Error('API error')),
      },
    };
    const summarizer = new Summarizer(client, new ScoringEngine());

    await expect(summarizer.summarize(makeItem())).rejects.toThrow('API error');
  });

  it('calculates scores using ScoringEngine', async () => {
    const client = makeClient('geospatial gis 3d plateau visualization map japan opendata citygml');
    const summarizer = new Summarizer(client, new ScoringEngine());

    const result = await summarizer.summarize(makeItem());

    expect(result.relevanceScore).toBeGreaterThan(0);
    expect(result.noveltyScore).toBe(70);
    expect(result.potentialScore).toBe(60); // hacker_news
    expect(result.totalScore).toBeGreaterThan(0);
  });

  it('marks item as selected when totalScore >= 60', async () => {
    const client = makeClient('geospatial gis 3d plateau visualization map');
    const summarizer = new Summarizer(client, new ScoringEngine());
    const result = await summarizer.summarize(makeItem({ source: 'plateau' }));
    expect(result.selected).toBe(true);
  });

  describe('processBatch()', () => {
    it('processes up to limit items', async () => {
      const client = makeClient();
      const summarizer = new Summarizer(client, new ScoringEngine());
      const items = Array.from({ length: 10 }, () => makeItem());

      const results = await summarizer.processBatch(items, 5);

      expect(results.length).toBeLessThanOrEqual(5);
    });

    it('returns all results when items count is under limit', async () => {
      const client = makeClient();
      const summarizer = new Summarizer(client, new ScoringEngine());
      const items = [makeItem(), makeItem()];

      const results = await summarizer.processBatch(items, 50);

      expect(results).toHaveLength(2);
    });

    it('skips failed items without throwing', async () => {
      const client: IAnthropicClient = {
        messages: {
          create: vi.fn()
            .mockResolvedValueOnce({ content: [{ type: 'text', text: 'summary 1' }] })
            .mockRejectedValueOnce(new Error('API error')),
        },
      };
      const summarizer = new Summarizer(client, new ScoringEngine());

      const results = await summarizer.processBatch([makeItem(), makeItem()]);

      expect(results).toHaveLength(1);
    });
  });
});
