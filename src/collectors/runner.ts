import { BaseCollector } from './base.js';
import { CollectorError } from './errors.js';
import { NoopHealthcheckNotifier, type IHealthcheckNotifier } from './healthcheck.js';
import type { IItemRepository } from './repository.js';
import type { CollectionSummary, CollectorSource } from './types.js';

function makeDefaultSummary(): CollectionSummary {
  const sources: CollectorSource[] = [
    'hacker_news',
    'reddit',
    'estat',
    'plateau',
    'local_file',
  ];
  return {
    totalCollected: 0,
    bySource: Object.fromEntries(
      sources.map((s) => [s, { success: 0, failed: false }]),
    ) as CollectionSummary['bySource'],
  };
}

export class CollectorRunner {
  constructor(
    private readonly collectors: BaseCollector[],
    private readonly repository: IItemRepository,
    private readonly healthcheck: IHealthcheckNotifier = new NoopHealthcheckNotifier(),
    private readonly healthcheckUuids: Partial<Record<CollectorSource, string>> = {},
  ) {}

  async run(): Promise<CollectionSummary> {
    const summary = makeDefaultSummary();

    const results = await Promise.allSettled(
      this.collectors.map((c) => c.collect()),
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const collector = this.collectors[i];
      const source = collector.source;

      if (result.status === 'fulfilled') {
        const items = result.value;
        await this.repository.saveAll(items);
        summary.bySource[source].success = items.length;
        summary.totalCollected += items.length;
      } else {
        summary.bySource[source].failed = true;
        const reason = result.reason;
        const message =
          reason instanceof CollectorError ? reason.message : String(reason);
        console.error(`[CollectorRunner] ${source}: ${message}`);
        const uuid = this.healthcheckUuids[source];
        if (uuid) {
          await this.healthcheck.fail(uuid, message);
        }
      }
    }

    return summary;
  }
}
