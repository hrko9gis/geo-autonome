import { BaseCollector } from './base.js';
import { CollectorError } from './errors.js';
import type { CollectorSource, RawItem } from './types.js';

interface HnHit {
  objectID: string;
  title: string;
  url?: string;
  created_at: string;
}

interface HnResponse {
  hits: HnHit[];
}

const QUERIES = [
  'geospatial',
  'GIS 3D map',
  'data visualization map',
  'PLATEAU 3D city',
  'Unity GIS',
  'Unreal Engine GIS',
  'Blender GIS',
  'deck.gl',
  'Mapbox',
  'WebGL map',
];

export class HackerNewsCollector extends BaseCollector {
  readonly source: CollectorSource = 'hacker_news';

  async collect(): Promise<RawItem[]> {
    const items: RawItem[] = [];
    const seen = new Set<string>();

    for (const query of QUERIES) {
      const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story`;
      let response: Response;
      try {
        response = await fetch(url);
      } catch (cause) {
        throw new CollectorError(
          `Failed to fetch Hacker News: ${String(cause)}`,
          this.source,
          cause,
        );
      }

      if (!response.ok) {
        throw new CollectorError(
          `Hacker News API returned ${response.status}`,
          this.source,
        );
      }

      const data = (await response.json()) as HnResponse;
      for (const hit of data.hits) {
        if (seen.has(hit.objectID)) continue;
        seen.add(hit.objectID);
        items.push(
          this.createItem({
            externalId: hit.objectID,
            title: hit.title,
            url: hit.url,
            rawData: hit,
          }),
        );
      }
    }

    return items;
  }
}
