import type { IAnthropicClient } from '../shared/anthropic-client.js';
import { SONNET_MODEL, assertAutonomousAgentModel } from '../shared/models.js';
import type { ScoredItem } from '../summarizers/types.js';
import { buildSystemPrompt, buildUserPrompt } from './prompts.js';
import type { Draft, DraftFrontmatter } from './types.js';

export type { IAnthropicClient };

export class DraftGeneratorError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'DraftGeneratorError';
  }
}

function extractText(response: { content: Array<{ type: string; text?: string }> }): string {
  const block = response.content.find((b) => b.type === 'text');
  return block?.text ?? '';
}

export function parseFrontmatter(markdown: string): { frontmatter: DraftFrontmatter; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/m.exec(markdown);
  if (!match) {
    return {
      frontmatter: { title: 'Untitled', description: '', tags: [], published: false },
      body: markdown,
    };
  }

  const yamlBlock = match[1] ?? '';
  const body = match[2] ?? '';

  const title = /^title:\s*(.+)$/m.exec(yamlBlock)?.[1]?.trim().replace(/^['"]|['"]$/g, '') ?? 'Untitled';
  const description = /^description:\s*(.+)$/m.exec(yamlBlock)?.[1]?.trim().replace(/^['"]|['"]$/g, '') ?? '';
  const publishedRaw = /^published:\s*(.+)$/m.exec(yamlBlock)?.[1]?.trim();
  const published = publishedRaw === 'true';
  const coverImage = /^cover_image:\s*(.+)$/m.exec(yamlBlock)?.[1]?.trim().replace(/^['"]|['"]$/g, '');

  const tagsInlineMatch = /^tags:\s*\[([^\]]*)\]/m.exec(yamlBlock);
  const tagsBlockMatches = yamlBlock.match(/^tags:\s*\n((?:\s*-\s*.+\n?)+)/m);
  let tags: string[] = [];
  if (tagsInlineMatch) {
    tags = tagsInlineMatch[1].split(',').map((t) => t.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
  } else if (tagsBlockMatches) {
    tags = (tagsBlockMatches[1] ?? '').split('\n')
      .map((line) => line.replace(/^\s*-\s*/, '').trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean);
  }

  return {
    frontmatter: { title, description, tags, published, ...(coverImage ? { cover_image: coverImage } : {}) },
    body,
  };
}

export class DraftGenerator {
  constructor(private readonly client: IAnthropicClient) {}

  async generate(item: ScoredItem, competitorUrls: string[] = []): Promise<Draft> {
    assertAutonomousAgentModel(SONNET_MODEL);
    const response = await this.client.messages.create({
      model: SONNET_MODEL,
      max_tokens: 4096,
      system: [
        {
          type: 'text' as const,
          text: buildSystemPrompt(),
          cache_control: { type: 'ephemeral' as const },
        },
      ],
      messages: [{ role: 'user', content: buildUserPrompt(item, competitorUrls) }],
    });

    const raw = extractText(response);
    if (!raw) {
      throw new DraftGeneratorError('Empty response from Sonnet API');
    }

    const { frontmatter } = parseFrontmatter(raw);

    return {
      id: crypto.randomUUID(),
      scoredItemId: item.id,
      frontmatter,
      contentMd: raw,
      status: 'pending',
      createdAt: new Date(),
    };
  }

  async generateBatch(
    items: ScoredItem[],
    count = 2,
    competitorUrls: string[] = [],
  ): Promise<Draft[]> {
    const targets = items.slice(0, count);
    const results = await Promise.allSettled(
      targets.map((item) => this.generate(item, competitorUrls)),
    );
    return results
      .filter((r): r is PromiseFulfilledResult<Draft> => r.status === 'fulfilled')
      .map((r) => r.value);
  }
}
