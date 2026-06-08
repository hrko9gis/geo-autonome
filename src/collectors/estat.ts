import { BaseCollector } from './base.js';
import { CollectorError } from './errors.js';
import type { CollectorSource, RawItem } from './types.js';

interface EStatTable {
  '@id': string;
  STAT_NAME: { '$': string } | string;
  TABLE_NAME: string;
  SURVEY_DATE?: string;
  OPEN_DATE?: string;
}

interface EStatResponse {
  GET_STATS_LIST?: {
    DATALIST_INF?: {
      TABLE_INF?: EStatTable | EStatTable[];
    };
  };
}

const SEARCH_WORDS = ['地理', '空間統計', '地図', '地域', 'GIS'];

export class EStatCollector extends BaseCollector {
  readonly source: CollectorSource = 'estat';

  async collect(): Promise<RawItem[]> {
    const apiKey = process.env['ESTAT_API_KEY'];
    if (!apiKey) {
      return [];
    }

    const items: RawItem[] = [];
    const seen = new Set<string>();

    for (const word of SEARCH_WORDS) {
      const url = `https://api.e-stat.go.jp/rest/3.0/app/json/getStatsList?appId=${encodeURIComponent(apiKey)}&searchWord=${encodeURIComponent(word)}&limit=20`;
      let response: Response;
      try {
        response = await fetch(url);
      } catch (cause) {
        throw new CollectorError(
          `Failed to fetch e-Stat: ${String(cause)}`,
          this.source,
          cause,
        );
      }

      if (!response.ok) {
        throw new CollectorError(
          `e-Stat API returned ${response.status}`,
          this.source,
        );
      }

      const data = (await response.json()) as EStatResponse;
      const tableInf = data.GET_STATS_LIST?.DATALIST_INF?.TABLE_INF;
      if (!tableInf) continue;

      const tables = Array.isArray(tableInf) ? tableInf : [tableInf];
      for (const table of tables) {
        const id = table['@id'];
        if (seen.has(id)) continue;
        seen.add(id);

        const statName =
          typeof table.STAT_NAME === 'object'
            ? table.STAT_NAME['$']
            : table.STAT_NAME;

        items.push(
          this.createItem({
            externalId: id,
            title: `${statName ?? ''} - ${table.TABLE_NAME}`.trim(),
            rawData: table,
          }),
        );
      }
    }

    return items;
  }
}
