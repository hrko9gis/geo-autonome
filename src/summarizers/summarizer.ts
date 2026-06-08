import type { RawItem } from '../collectors/types.js';
import type { IAnthropicClient } from '../shared/anthropic-client.js';
import { HAIKU_MODEL, assertAutonomousAgentModel } from '../shared/models.js';
import { ScoringEngine } from './scoring-engine.js';
import type { ScoredItem } from './types.js';

export type { IAnthropicClient };

export class SummarizerError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'SummarizerError';
  }
}

const SYSTEM_PROMPT =
  'You are a research assistant for a geospatial technology blog. ' +
  'Summarize the given content in 2-3 English sentences focusing on geospatial, 3D city models, ' +
  'or data visualization aspects. If the content is not relevant to these topics, respond with exactly: Not relevant.';

function buildUserPrompt(item: RawItem): string {
  const parts: string[] = [];
  if (item.title) parts.push(`Title: ${item.title}`);
  if (item.url) parts.push(`URL: ${item.url}`);
  if (item.content) parts.push(`Content: ${item.content.slice(0, 1000)}`);
  return parts.join('\n');
}

function extractText(response: { content: Array<{ type: string; text?: string }> }): string {
  const block = response.content.find((b) => b.type === 'text');
  return block?.text ?? '';
}

export class Summarizer {
  constructor(
    private readonly client: IAnthropicClient,
    private readonly engine: ScoringEngine = new ScoringEngine(),
  ) {}

  async summarize(item: RawItem): Promise<ScoredItem> {
    assertAutonomousAgentModel(HAIKU_MODEL);
    const response = await this.client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 256,
      system: [
        {
          type: 'text' as const,
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' as const },
        },
      ],
      messages: [{ role: 'user', content: buildUserPrompt(item) }],
    });

    const summaryEn = extractText(response);
    const textForScoring = `${item.title ?? ''} ${item.content ?? ''} ${summaryEn}`;
    const relevance = this.engine.calculateRelevance(textForScoring);
    const novelty = this.engine.calculateNovelty();
    const potential = this.engine.calculatePotential(item.source);
    const total = this.engine.calculateTotal(relevance, novelty, potential);

    return {
      id: crypto.randomUUID(),
      rawItemId: item.id,
      source: item.source,
      title: item.title,
      url: item.url,
      summaryEn,
      relevanceScore: relevance,
      noveltyScore: novelty,
      potentialScore: potential,
      totalScore: total,
      selected: this.engine.isSelected(total),
      scoredAt: new Date(),
    };
  }

  async processBatch(items: RawItem[], limit = 50): Promise<ScoredItem[]> {
    const targets = items.slice(0, limit);
    const results = await Promise.allSettled(targets.map((item) => this.summarize(item)));
    return results
      .filter((r): r is PromiseFulfilledResult<ScoredItem> => r.status === 'fulfilled')
      .map((r) => r.value);
  }
}
