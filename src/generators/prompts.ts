import type { ScoredItem } from '../summarizers/types.js';

export function buildSystemPrompt(): string {
  return `You are an expert technical writer specializing in geospatial technology, 3D city models, and data visualization for international developers.

Writing rules:
1. Write in English, targeting dev.to audience (developers worldwide)
2. For uncertain or assumed facts, always use hedging language: "I assume", "It appears that", "According to [source]", "It seems that"
3. Every article must include:
   - Source URL with full citation
   - Statistical year or data version (e.g., "as of 2024", "version 2.0")
   - Specific place names with romanization if Japanese (e.g., "Osaka (大阪)")
   - At least one working code snippet (JavaScript, Python, or shell)
4. Differentiate from competitor articles by providing unique insights, different angles, or original code examples
5. Output format: complete Markdown document with YAML frontmatter followed by article body

Frontmatter requirements:
- title: Compelling, SEO-friendly title (max 60 chars)
- description: Concise summary for social sharing (max 140 chars)
- tags: Array of 2-4 relevant tags (e.g., ["geospatial", "3d", "japan", "opendata"])
- published: false
- cover_image: omit unless specified

The frontmatter block must be delimited by triple dashes (---) at the start of the output.`;
}

export function buildUserPrompt(item: ScoredItem, competitorUrls: string[] = []): string {
  const parts: string[] = [
    'Write a technical article based on the following source:\n',
    `Title: ${item.title ?? 'Unknown'}`,
    `Source URL: ${item.url ?? 'N/A'}`,
    `Summary: ${item.summaryEn}`,
    `Source type: ${item.source}`,
  ];

  if (competitorUrls.length > 0) {
    parts.push('');
    parts.push('Competitor articles to differentiate from (do NOT copy their content):');
    for (const url of competitorUrls) {
      parts.push(`- ${url}`);
    }
  }

  parts.push('');
  parts.push(
    'Generate a complete Markdown article (800-1500 words) with YAML frontmatter block at the top. ' +
    'Ensure the article is unique, informative, and provides practical value to developers.',
  );

  return parts.join('\n');
}
