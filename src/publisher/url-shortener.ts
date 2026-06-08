interface ShortenResponse {
  shortUrl: string;
}

export class URLShortenerClient {
  constructor(private readonly baseUrl: string | undefined) {}

  async shorten(url: string, postId: string): Promise<string> {
    if (!this.baseUrl) return url;

    const response = await fetch(`${this.baseUrl}/api/shorten`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, postId }),
    });

    if (!response.ok) {
      return url;
    }

    const data = (await response.json()) as ShortenResponse;
    return data.shortUrl ?? url;
  }

  async replaceLinks(content: string, postId: string): Promise<string> {
    if (!this.baseUrl) return content;

    const urlPattern = /\((https?:\/\/[^\s)]+)\)/g;
    const matches = [...content.matchAll(urlPattern)];
    if (matches.length === 0) return content;

    let result = content;
    for (const match of matches) {
      const originalUrl = match[1];
      if (!originalUrl) continue;
      const shortened = await this.shorten(originalUrl, postId);
      if (shortened !== originalUrl) {
        result = result.split(`(${originalUrl})`).join(`(${shortened})`);
      }
    }
    return result;
  }
}
