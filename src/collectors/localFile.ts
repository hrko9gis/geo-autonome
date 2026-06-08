import { promises as fs } from 'node:fs';
import path from 'node:path';
import { BaseCollector } from './base.js';
import type { CollectorSource, RawItem } from './types.js';

const GIS_EXTENSIONS = new Set(['.geojson', '.shp']);
const DEFAULT_DATA_DIR = 'data';

export class LocalFileCollector extends BaseCollector {
  readonly source: CollectorSource = 'local_file';

  constructor(private readonly dataDir: string = DEFAULT_DATA_DIR) {
    super();
  }

  async collect(): Promise<RawItem[]> {
    let entries: string[];
    try {
      entries = await fs.readdir(this.dataDir);
    } catch {
      return [];
    }

    const items: RawItem[] = [];
    for (const entry of entries) {
      const ext = path.extname(entry).toLowerCase();
      if (!GIS_EXTENSIONS.has(ext)) continue;

      const filePath = path.join(this.dataDir, entry);
      items.push(
        this.createItem({
          externalId: filePath,
          title: entry,
          url: `file://${path.resolve(filePath)}`,
        }),
      );
    }

    return items;
  }
}
