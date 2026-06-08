import { XMLParser } from 'fast-xml-parser';
import { BaseCollector } from './base.js';
import { CollectorError } from './errors.js';
import type { CollectorSource, RawItem } from './types.js';

interface RssItem {
  title?: string;
  link?: string;
  description?: string;
  guid?: string | { '#text': string };
}

interface AtomEntry {
  title?: string | { '#text': string };
  id?: string;
  link?: { '@_href': string } | Array<{ '@_href': string; '@_rel'?: string }>;
  summary?: string;
}

const FEED_URLS = [
  'https://github.com/Project-PLATEAU.atom',
  'https://www.mlit.go.jp/rss/rss.xml',
  'https://www.gsi.go.jp/common/000070471.xml',
  'https://www.mlit.go.jp/plateau/news/feed/',
];

export class PlateauFeedCollector extends BaseCollector {
  readonly source: CollectorSource = 'plateau';

  private readonly parser = new XMLParser({ ignoreAttributes: false });

  async collect(): Promise<RawItem[]> {
    const items: RawItem[] = [];

    for (const feedUrl of FEED_URLS) {
      let response: Response;
      try {
        response = await fetch(feedUrl);
      } catch {
        continue;
      }

      if (!response.ok) {
        if (response.status === 404) continue;
        throw new CollectorError(
          `PLATEAU feed returned ${response.status}`,
          this.source,
        );
      }

      const xml = await response.text();
      let parsed: Record<string, unknown>;
      try {
        parsed = this.parser.parse(xml) as Record<string, unknown>;
      } catch (cause) {
        throw new CollectorError(
          `Failed to parse PLATEAU feed XML: ${String(cause)}`,
          this.source,
          cause,
        );
      }

      const feedItems = this.extractItems(parsed);
      items.push(...feedItems);
    }

    return items;
  }

  private extractItems(parsed: Record<string, unknown>): RawItem[] {
    const rss = parsed['rss'] as { channel?: { item?: RssItem | RssItem[] } } | undefined;
    if (rss?.channel) {
      const raw = rss.channel.item;
      const rssItems = raw ? (Array.isArray(raw) ? raw : [raw]) : [];
      return rssItems.map((item) =>
        this.createItem({
          externalId: typeof item.guid === 'object' ? item.guid['#text'] : item.guid,
          title: item.title,
          url: item.link,
          content: item.description,
          rawData: item,
        }),
      );
    }

    const feed = parsed['feed'] as { entry?: AtomEntry | AtomEntry[] } | undefined;
    if (feed) {
      const raw = feed.entry;
      const entries = raw ? (Array.isArray(raw) ? raw : [raw]) : [];
      return entries.map((entry) => {
        const title =
          typeof entry.title === 'object' ? entry.title['#text'] : entry.title;
        const linkHref = Array.isArray(entry.link)
          ? (entry.link.find((l) => !l['@_rel'] || l['@_rel'] === 'alternate')?.['@_href'] ?? entry.link[0]?.['@_href'])
          : entry.link?.['@_href'];
        return this.createItem({
          externalId: entry.id,
          title,
          url: linkHref,
          content: entry.summary,
          rawData: entry,
        });
      });
    }

    return [];
  }
}
