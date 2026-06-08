import { describe, expect, it } from 'vitest';
import { ScoringEngine } from '../../src/summarizers/scoring-engine.js';

describe('ScoringEngine', () => {
  const engine = new ScoringEngine();

  describe('calculateRelevance()', () => {
    it('returns 0 when text has no geo keywords', () => {
      expect(engine.calculateRelevance('hello world weather sports')).toBe(0);
    });

    it('returns positive score for single matching keyword', () => {
      const score = engine.calculateRelevance('geospatial data analysis');
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('caps at 100 when many keywords match', () => {
      const text = 'geospatial gis 3d plateau visualization map unity unreal blender japan';
      expect(engine.calculateRelevance(text)).toBe(100);
    });

    it('is case-insensitive', () => {
      const lower = engine.calculateRelevance('geospatial');
      const upper = engine.calculateRelevance('GEOSPATIAL');
      const mixed = engine.calculateRelevance('GeoSpatial');
      expect(lower).toBe(upper);
      expect(lower).toBe(mixed);
    });

    it('matches deck.gl keyword', () => {
      expect(engine.calculateRelevance('deck.gl visualization')).toBeGreaterThan(0);
    });

    it('reaches 100 with exactly 5 matching keywords', () => {
      const text = 'geospatial gis 3d plateau visualization';
      expect(engine.calculateRelevance(text)).toBe(100);
    });
  });

  describe('calculatePotential()', () => {
    it('returns 90 for plateau', () => {
      expect(engine.calculatePotential('plateau')).toBe(90);
    });

    it('returns 70 for estat', () => {
      expect(engine.calculatePotential('estat')).toBe(70);
    });

    it('returns 60 for hacker_news', () => {
      expect(engine.calculatePotential('hacker_news')).toBe(60);
    });

    it('returns 50 for reddit', () => {
      expect(engine.calculatePotential('reddit')).toBe(50);
    });

    it('returns 40 for local_file', () => {
      expect(engine.calculatePotential('local_file')).toBe(40);
    });
  });

  describe('calculateNovelty()', () => {
    it('returns 70 (default value)', () => {
      expect(engine.calculateNovelty()).toBe(70);
    });
  });

  describe('calculateTotal()', () => {
    it('applies weights: relevance×0.40 + novelty×0.35 + potential×0.25', () => {
      const result = engine.calculateTotal(100, 100, 100);
      expect(result).toBe(100);
    });

    it('calculates weighted average correctly', () => {
      const result = engine.calculateTotal(80, 70, 60);
      const expected = 80 * 0.4 + 70 * 0.35 + 60 * 0.25;
      expect(result).toBeCloseTo(expected, 5);
    });

    it('returns 0 when all scores are 0', () => {
      expect(engine.calculateTotal(0, 0, 0)).toBe(0);
    });
  });

  describe('isSelected()', () => {
    it('returns true when totalScore >= 60', () => {
      expect(engine.isSelected(60)).toBe(true);
      expect(engine.isSelected(75)).toBe(true);
      expect(engine.isSelected(100)).toBe(true);
    });

    it('returns false when totalScore < 60', () => {
      expect(engine.isSelected(59.9)).toBe(false);
      expect(engine.isSelected(0)).toBe(false);
    });
  });

  describe('customPotential override', () => {
    it('uses customPotential when provided for a source', () => {
      const custom = new ScoringEngine({ hacker_news: 95 });
      expect(custom.calculatePotential('hacker_news')).toBe(95);
    });

    it('falls back to default when source not in customPotential', () => {
      const custom = new ScoringEngine({ hacker_news: 95 });
      expect(custom.calculatePotential('plateau')).toBe(90);
    });

    it('uses all defaults when no customPotential provided', () => {
      const defaultEngine = new ScoringEngine();
      expect(defaultEngine.calculatePotential('hacker_news')).toBe(60);
    });
  });
});
