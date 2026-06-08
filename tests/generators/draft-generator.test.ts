import { describe, expect, it, vi } from 'vitest';
import { DraftGenerator, DraftGeneratorError, parseFrontmatter } from '../../src/generators/draft-generator.js';
import type { IAnthropicClient } from '../../src/generators/draft-generator.js';
import type { ScoredItem } from '../../src/summarizers/types.js';

const MOCK_MARKDOWN = `---
title: How to Use PLATEAU 3D City Models in Unity
description: A practical guide to using Japan's open 3D city model data in Unity projects.
tags: [geospatial, japan, unity, 3d]
published: false
---

# How to Use PLATEAU 3D City Models in Unity

It appears that PLATEAU provides high-quality 3D city models. I assume most developers are not familiar with CityGML format.

According to the PLATEAU official site (as of 2024), the dataset includes LOD1-4 models.

## Code Example

\`\`\`javascript
// Load PLATEAU data
const data = await fetch('https://example.com/plateau/osaka.geojson');
\`\`\`
`;

function makeClient(text = MOCK_MARKDOWN): IAnthropicClient {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text }],
      }),
    },
  };
}

function makeScoredItem(): ScoredItem {
  return {
    id: 'scored-001',
    rawItemId: 'raw-001',
    source: 'plateau',
    title: 'PLATEAU 3D City Model Released for Osaka',
    url: 'https://plateau.mlit.go.jp/osaka',
    summaryEn: 'Japan released 3D city models for Osaka using CityGML format.',
    relevanceScore: 90,
    noveltyScore: 70,
    potentialScore: 90,
    totalScore: 84.5,
    selected: true,
    scoredAt: new Date(),
  };
}

describe('parseFrontmatter()', () => {
  it('extracts title from YAML frontmatter', () => {
    const { frontmatter } = parseFrontmatter(MOCK_MARKDOWN);
    expect(frontmatter.title).toBe('How to Use PLATEAU 3D City Models in Unity');
  });

  it('extracts description from YAML frontmatter', () => {
    const { frontmatter } = parseFrontmatter(MOCK_MARKDOWN);
    expect(frontmatter.description).toContain('practical guide');
  });

  it('extracts tags array from YAML frontmatter', () => {
    const { frontmatter } = parseFrontmatter(MOCK_MARKDOWN);
    expect(frontmatter.tags).toEqual(['geospatial', 'japan', 'unity', '3d']);
  });

  it('published is false by default', () => {
    const { frontmatter } = parseFrontmatter(MOCK_MARKDOWN);
    expect(frontmatter.published).toBe(false);
  });

  it('returns Untitled when frontmatter is missing', () => {
    const { frontmatter } = parseFrontmatter('No frontmatter here');
    expect(frontmatter.title).toBe('Untitled');
  });
});

describe('DraftGenerator', () => {
  it('generate() returns a Draft with status pending', async () => {
    const generator = new DraftGenerator(makeClient());
    const draft = await generator.generate(makeScoredItem());
    expect(draft.status).toBe('pending');
  });

  it('generate() sets scoredItemId correctly', async () => {
    const item = makeScoredItem();
    const generator = new DraftGenerator(makeClient());
    const draft = await generator.generate(item);
    expect(draft.scoredItemId).toBe(item.id);
  });

  it('generate() returns Draft with contentMd containing YAML frontmatter', async () => {
    const generator = new DraftGenerator(makeClient());
    const draft = await generator.generate(makeScoredItem());
    expect(draft.contentMd).toContain('---');
    expect(draft.contentMd).toContain('title:');
  });

  it('generate() parses frontmatter into structured object', async () => {
    const generator = new DraftGenerator(makeClient());
    const draft = await generator.generate(makeScoredItem());
    expect(draft.frontmatter.title).toBe('How to Use PLATEAU 3D City Models in Unity');
    expect(draft.frontmatter.tags).toBeInstanceOf(Array);
  });

  it('generate() calls Sonnet 4.6 model', async () => {
    const client = makeClient();
    const generator = new DraftGenerator(client);
    await generator.generate(makeScoredItem());
    expect(client.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-sonnet-4-6' }),
    );
  });

  it('generate() includes competitor URLs in user prompt when provided', async () => {
    const client = makeClient();
    const generator = new DraftGenerator(client);
    const competitors = ['https://dev.to/competitor/plateau-guide'];
    await generator.generate(makeScoredItem(), competitors);

    const callArgs = (client.messages.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const userContent = callArgs.messages[0].content as string;
    expect(userContent).toContain('https://dev.to/competitor/plateau-guide');
  });

  it('generate() throws DraftGeneratorError when API returns empty content', async () => {
    const client: IAnthropicClient = {
      messages: {
        create: vi.fn().mockResolvedValue({ content: [] }),
      },
    };
    const generator = new DraftGenerator(client);
    await expect(generator.generate(makeScoredItem())).rejects.toThrow(DraftGeneratorError);
  });

  it('generate() sets createdAt as a Date', async () => {
    const generator = new DraftGenerator(makeClient());
    const draft = await generator.generate(makeScoredItem());
    expect(draft.createdAt).toBeInstanceOf(Date);
  });

  describe('generateBatch()', () => {
    it('returns up to count drafts', async () => {
      const generator = new DraftGenerator(makeClient());
      const items = [makeScoredItem(), makeScoredItem(), makeScoredItem()];
      const drafts = await generator.generateBatch(items, 2);
      expect(drafts.length).toBeLessThanOrEqual(2);
    });

    it('skips failed items without throwing', async () => {
      const client: IAnthropicClient = {
        messages: {
          create: vi.fn()
            .mockResolvedValueOnce({ content: [{ type: 'text', text: MOCK_MARKDOWN }] })
            .mockRejectedValueOnce(new Error('API error')),
        },
      };
      const generator = new DraftGenerator(client);
      const drafts = await generator.generateBatch([makeScoredItem(), makeScoredItem()]);
      expect(drafts).toHaveLength(1);
    });
  });
});
