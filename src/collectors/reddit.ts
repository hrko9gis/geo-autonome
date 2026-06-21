import { XMLParser } from 'fast-xml-parser';
import { BaseCollector } from './base.js';
import { CollectorError } from './errors.js';
import type { CollectorSource, RawItem } from './types.js';

interface AtomEntry {
  id?: string;
  title?: string | { '#text': string };
  link?: { '@_href': string } | Array<{ '@_href': string; '@_rel'?: string }>;
  content?: string | { '#text': string };
}

interface AtomFeed {
  feed?: { entry?: AtomEntry | AtomEntry[] };
}

const SUBREDDITS = [
  'gamedev',
  'Unity3D',
  'unrealengine',
  'blender',
  'gis',
  'vrchat',
  'geospatial',
];

export class RedditCollector extends BaseCollector {
  readonly source: CollectorSource = 'reddit';

  private readonly parser = new XMLParser({ ignoreAttributes: false });

  async collect(): Promise<RawItem[]> {
    const items: RawItem[] = [];
    let successCount = 0;
    let lastError: CollectorError | undefined;

    for (const subreddit of SUBREDDITS) {
      const url = `https://www.reddit.com/r/${subreddit}/new.rss?limit=25`;
      let response: Response;
      try {
        response = await fetch(url, {
          headers: { 'User-Agent': 'geo-autonome/1.0 (data collection bot)' },
        });
      } catch (cause) {
        // Reddit frequently blocks datacenter/cloud IPs (429/403). Treat any
        // single-subreddit failure as recoverable and keep going; only fail the
        // whole collector if every subreddit fails (see end of loop).
        lastError = new CollectorError(
          `Failed to fetch Reddit r/${subreddit}: ${String(cause)}`,
          this.source,
          cause,
        );
        continue;
      }

      if (!response.ok) {
        lastError = new CollectorError(
          `Reddit API returned ${response.status} for r/${subreddit}`,
          this.source,
        );
        continue;
      }

      const xml = await response.text();
      let parsed: AtomFeed;
      try {
        parsed = this.parser.parse(xml) as AtomFeed;
      } catch (cause) {
        lastError = new CollectorError(
          `Failed to parse Reddit r/${subreddit} feed: ${String(cause)}`,
          this.source,
          cause,
        );
        continue;
      }

      successCount++;
      const raw = parsed.feed?.entry;
      const entries = raw ? (Array.isArray(raw) ? raw : [raw]) : [];

      for (const entry of entries) {
        const title = typeof entry.title === 'object' ? entry.title['#text'] : entry.title;
        const linkHref = Array.isArray(entry.link)
          ? (entry.link.find((l) => !l['@_rel'] || l['@_rel'] === 'alternate')?.['@_href'] ?? entry.link[0]?.['@_href'])
          : entry.link?.['@_href'];
        const content = typeof entry.content === 'object' ? entry.content['#text'] : entry.content;
        items.push(
          this.createItem({
            externalId: entry.id,
            title,
            url: linkHref,
            content,
            rawData: entry,
          }),
        );
      }
    }

    if (successCount === 0) {
      throw (
        lastError ??
        new CollectorError('Reddit collection failed for all subreddits', this.source)
      );
    }

    return items;
  }
}
