import { describe, expect, it } from 'vitest';
import { buildSystemPrompt, buildUserPrompt } from '../../src/generators/prompts.js';
import type { ScoredItem } from '../../src/summarizers/types.js';

function makeScoredItem(override: Partial<ScoredItem> = {}): ScoredItem {
  return {
    id: 'scored-1',
    rawItemId: 'raw-1',
    source: 'plateau',
    title: 'PLATEAU 3D City Model Released',
    url: 'https://example.com/plateau-release',
    summaryEn: 'Japan released new 3D city model data for Osaka.',
    relevanceScore: 90,
    noveltyScore: 70,
    potentialScore: 90,
    totalScore: 84.5,
    selected: true,
    scoredAt: new Date(),
    ...override,
  };
}

describe('buildSystemPrompt()', () => {
  it('includes "I assume" hedging instruction', () => {
    expect(buildSystemPrompt()).toContain('I assume');
  });

  it('includes "It appears that" hedging instruction', () => {
    expect(buildSystemPrompt()).toContain('It appears that');
  });

  it('requires code snippet in every article', () => {
    const prompt = buildSystemPrompt();
    expect(prompt.toLowerCase()).toMatch(/code\s*snippet/i);
  });

  it('specifies dev.to frontmatter format', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('frontmatter');
    expect(prompt).toContain('title');
    expect(prompt).toContain('description');
    expect(prompt).toContain('tags');
    expect(prompt).toContain('published');
  });

  it('requires source URL citation', () => {
    expect(buildSystemPrompt()).toMatch(/source\s*url/i);
  });

  it('requires statistical year or data version', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toMatch(/year|version/i);
  });
});

describe('buildUserPrompt()', () => {
  it('includes item title', () => {
    const item = makeScoredItem();
    expect(buildUserPrompt(item)).toContain('PLATEAU 3D City Model Released');
  });

  it('includes item URL', () => {
    const item = makeScoredItem();
    expect(buildUserPrompt(item)).toContain('https://example.com/plateau-release');
  });

  it('includes item summary', () => {
    const item = makeScoredItem();
    expect(buildUserPrompt(item)).toContain('Japan released new 3D city model');
  });

  it('includes competitor URLs when provided', () => {
    const item = makeScoredItem();
    const competitors = ['https://competitor1.com/article', 'https://competitor2.com/post'];
    const prompt = buildUserPrompt(item, competitors);
    expect(prompt).toContain('https://competitor1.com/article');
    expect(prompt).toContain('https://competitor2.com/post');
  });

  it('does not include competitor section when no URLs provided', () => {
    const item = makeScoredItem();
    const prompt = buildUserPrompt(item, []);
    expect(prompt).not.toContain('Competitor articles');
  });

  it('handles missing title gracefully', () => {
    const item = makeScoredItem({ title: undefined });
    expect(() => buildUserPrompt(item)).not.toThrow();
  });
});
