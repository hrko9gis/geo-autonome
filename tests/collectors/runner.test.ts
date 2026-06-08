import { describe, expect, it, vi } from 'vitest';
import { CollectorRunner } from '../../src/collectors/runner.js';
import { InMemoryItemRepository } from '../../src/collectors/repository.js';
import { BaseCollector } from '../../src/collectors/base.js';
import { CollectorError } from '../../src/collectors/errors.js';
import type { IHealthcheckNotifier } from '../../src/collectors/healthcheck.js';
import type { CollectorSource, RawItem } from '../../src/collectors/types.js';

class StubCollector extends BaseCollector {
  constructor(
    readonly source: CollectorSource,
    private readonly items: RawItem[],
  ) {
    super();
  }

  async collect(): Promise<RawItem[]> {
    return this.items;
  }
}

class FailingCollector extends BaseCollector {
  readonly source: CollectorSource = 'reddit';

  async collect(): Promise<RawItem[]> {
    throw new CollectorError('Test failure', this.source);
  }
}

function makeItem(source: CollectorSource): RawItem {
  return {
    id: crypto.randomUUID(),
    source,
    title: `Test item from ${source}`,
    collectedAt: new Date(),
  };
}

describe('CollectorRunner', () => {
  it('collects items from all collectors and saves to repository', async () => {
    const repo = new InMemoryItemRepository();
    const hnItem = makeItem('hacker_news');
    const redditItem = makeItem('reddit');

    const runner = new CollectorRunner(
      [
        new StubCollector('hacker_news', [hnItem]),
        new StubCollector('reddit', [redditItem]),
      ],
      repo,
    );

    const summary = await runner.run();
    expect(summary.totalCollected).toBe(2);
    expect(summary.bySource['hacker_news'].success).toBe(1);
    expect(summary.bySource['reddit'].success).toBe(1);

    const stored = await repo.findAll();
    expect(stored).toHaveLength(2);
  });

  it('marks failed collectors without propagating the error', async () => {
    const repo = new InMemoryItemRepository();
    const hnItem = makeItem('hacker_news');

    const runner = new CollectorRunner(
      [
        new StubCollector('hacker_news', [hnItem]),
        new FailingCollector(),
      ],
      repo,
    );

    const summary = await runner.run();
    expect(summary.totalCollected).toBe(1);
    expect(summary.bySource['hacker_news'].success).toBe(1);
    expect(summary.bySource['reddit'].failed).toBe(true);
  });

  it('returns zero totals when all collectors fail', async () => {
    const repo = new InMemoryItemRepository();
    const runner = new CollectorRunner([new FailingCollector()], repo);

    const summary = await runner.run();
    expect(summary.totalCollected).toBe(0);
    expect(summary.bySource['reddit'].failed).toBe(true);
  });

  it('handles empty collector list', async () => {
    const repo = new InMemoryItemRepository();
    const runner = new CollectorRunner([], repo);

    const summary = await runner.run();
    expect(summary.totalCollected).toBe(0);
  });

  it('calls healthcheck.fail() with uuid when a collector fails and uuid is configured', async () => {
    const repo = new InMemoryItemRepository();
    const notifier: IHealthcheckNotifier = {
      ping: vi.fn(),
      fail: vi.fn().mockResolvedValue(undefined),
    };

    const runner = new CollectorRunner(
      [new FailingCollector()],
      repo,
      notifier,
      { reddit: 'reddit-uuid-123' },
    );

    await runner.run();

    expect(notifier.fail).toHaveBeenCalledWith('reddit-uuid-123', expect.any(String));
  });

  it('does not call healthcheck.fail() when no uuid is configured for a failed source', async () => {
    const repo = new InMemoryItemRepository();
    const notifier: IHealthcheckNotifier = {
      ping: vi.fn(),
      fail: vi.fn().mockResolvedValue(undefined),
    };

    const runner = new CollectorRunner([new FailingCollector()], repo, notifier, {});

    await runner.run();

    expect(notifier.fail).not.toHaveBeenCalled();
  });
});
