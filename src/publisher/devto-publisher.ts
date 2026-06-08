import type { Draft } from '../generators/types.js';

const DEVTO_API_URL = 'https://dev.to/api/articles';

export class PublisherError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'PublisherError';
  }
}

export class DevToPublisher {
  constructor(
    private readonly apiKey: string,
    private readonly shouldPublish: boolean = true,
  ) {}

  async publish(draft: Draft, content: string): Promise<string> {
    const { title, tags } = draft.frontmatter;

    const body = {
      article: {
        title,
        body_markdown: content,
        tags: tags.slice(0, 4),
        published: this.shouldPublish,
      },
    };

    let response: Response;
    try {
      response = await fetch(DEVTO_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.apiKey,
        },
        body: JSON.stringify(body),
      });
    } catch (cause) {
      throw new PublisherError(`Failed to reach dev.to API: ${String(cause)}`, cause);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new PublisherError(`dev.to API returned ${response.status}: ${text}`);
    }

    const data = (await response.json()) as { url?: string };
    return data.url ?? `${DEVTO_API_URL}/${title}`;
  }
}
