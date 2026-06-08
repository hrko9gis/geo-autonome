import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TrademarkScreener } from '../../src/osaka/trademark-screener.js';

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

const MOCK_PATTERNS = JSON.stringify([
  { keyword: 'glico', strategy: 'abstract', replacement: 'generic_billboard', notes: 'Glico sign' },
  { keyword: 'mcdonalds', strategy: 'delete', notes: 'McDonald\'s golden arches' },
  { keyword: 'lawson', strategy: 'abstract', replacement: 'generic_convenience_store', notes: 'Lawson brand' },
]);

describe('TrademarkScreener', () => {
  beforeEach(async () => {
    const { readFile } = await import('node:fs/promises');
    (readFile as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_PATTERNS);
  });

  afterEach(() => vi.clearAllMocks());

  describe('screen()', () => {
    it('returns matched=true for a file path containing a trademark keyword', async () => {
      const screener = new TrademarkScreener('/data/trademark_patterns.json');
      const result = await screener.screen('/textures/dotonbori_glico_sign.png');

      expect(result.matched).toBe(true);
      expect(result.pattern?.keyword).toBe('glico');
      expect(result.strategy).toBe('abstract');
    });

    it('returns matched=false for a file path with no trademark keyword', async () => {
      const screener = new TrademarkScreener('/data/trademark_patterns.json');
      const result = await screener.screen('/textures/building_wall_generic.png');

      expect(result.matched).toBe(false);
      expect(result.pattern).toBeUndefined();
    });

    it('matches delete strategy for mcdonalds keyword', async () => {
      const screener = new TrademarkScreener('/data/trademark_patterns.json');
      const result = await screener.screen('/textures/mcdonalds_store_front.png');

      expect(result.matched).toBe(true);
      expect(result.strategy).toBe('delete');
    });

    it('matches case-insensitively', async () => {
      const screener = new TrademarkScreener('/data/trademark_patterns.json');
      const result = await screener.screen('/textures/GLICO_SIGN_night.png');

      expect(result.matched).toBe(true);
    });

    it('ignores separator characters in matching', async () => {
      const screener = new TrademarkScreener('/data/trademark_patterns.json');
      const result = await screener.screen('/textures/law-son_store.png');

      expect(result.matched).toBe(true);
      expect(result.pattern?.keyword).toBe('lawson');
    });
  });

  describe('screenAll()', () => {
    it('processes multiple files and returns results for each', async () => {
      const screener = new TrademarkScreener('/data/trademark_patterns.json');
      const results = await screener.screenAll([
        '/textures/glico_sign.png',
        '/textures/generic_wall.png',
        '/textures/mcdonalds_sign.png',
      ]);

      expect(results).toHaveLength(3);
      expect(results[0].matched).toBe(true);
      expect(results[1].matched).toBe(false);
      expect(results[2].matched).toBe(true);
    });

    it('returns empty array for empty input', async () => {
      const screener = new TrademarkScreener('/data/trademark_patterns.json');
      const results = await screener.screenAll([]);
      expect(results).toHaveLength(0);
    });
  });
});
