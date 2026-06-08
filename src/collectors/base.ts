import type { CollectorSource, RawItem } from './types.js';

export abstract class BaseCollector {
  abstract readonly source: CollectorSource;
  abstract collect(): Promise<RawItem[]>;

  protected createItem(
    partial: Omit<RawItem, 'id' | 'source' | 'collectedAt'>,
  ): RawItem {
    return {
      id: crypto.randomUUID(),
      source: this.source,
      collectedAt: new Date(),
      ...partial,
    };
  }
}
