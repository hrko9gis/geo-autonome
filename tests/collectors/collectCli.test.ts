import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildHealthcheckUuids } from '../../src/collectors/collect-cli.js';

vi.mock('node:fs', () => ({
  mkdirSync: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  appendFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(''),
}));

vi.mock('../../src/collectors/runner.js', () => ({
  CollectorRunner: vi.fn().mockImplementation(() => ({
    run: vi.fn().mockResolvedValue({
      totalCollected: 0,
      bySource: {
        hacker_news: { success: 0, failed: false },
        reddit: { success: 0, failed: false },
        estat: { success: 0, failed: false },
        plateau: { success: 0, failed: false },
        local_file: { success: 0, failed: false },
      },
    }),
  })),
}));

describe('buildHealthcheckUuids', () => {
  afterEach(() => {
    delete process.env['HEALTHCHECK_UUID_MAP'];
  });

  it('returns empty object when HEALTHCHECK_UUID_MAP is not set', () => {
    delete process.env['HEALTHCHECK_UUID_MAP'];
    expect(buildHealthcheckUuids()).toEqual({});
  });

  it('parses valid JSON from HEALTHCHECK_UUID_MAP', () => {
    process.env['HEALTHCHECK_UUID_MAP'] = JSON.stringify({ hacker_news: 'uuid-hn', reddit: 'uuid-r' });
    expect(buildHealthcheckUuids()).toEqual({ hacker_news: 'uuid-hn', reddit: 'uuid-r' });
  });

  it('returns empty object and warns when JSON is invalid', () => {
    process.env['HEALTHCHECK_UUID_MAP'] = 'not-json';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const result = buildHealthcheckUuids();

    expect(result).toEqual({});
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Invalid HEALTHCHECK_UUID_MAP'),
      expect.anything(),
    );
    warnSpy.mockRestore();
  });
});

describe('main()', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((_code) => {
      throw new Error(`process.exit(${_code ?? 'undefined'})`);
    });
  });

  afterEach(() => {
    exitSpy.mockRestore();
    delete process.env['HEALTHCHECK_BASE_URL'];
    delete process.env['HEALTHCHECK_UUID_MAP'];
  });

  it('does not call process.exit when all collectors succeed', async () => {
    const { main } = await import('../../src/collectors/collect-cli.js');
    await expect(main()).resolves.toBeUndefined();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('calls process.exit(2) when any collector fails', async () => {
    const { CollectorRunner } = await import('../../src/collectors/runner.js');
    vi.mocked(CollectorRunner).mockImplementationOnce(() => ({
      run: vi.fn().mockResolvedValue({
        totalCollected: 0,
        bySource: {
          hacker_news: { success: 0, failed: false },
          reddit: { success: 0, failed: true },
          estat: { success: 0, failed: false },
          plateau: { success: 0, failed: false },
          local_file: { success: 0, failed: false },
        },
      }),
    }));

    const { main } = await import('../../src/collectors/collect-cli.js');
    await expect(main()).rejects.toThrow('process.exit(2)');
    expect(exitSpy).toHaveBeenCalledWith(2);
  });

  it('uses HealthcheckNotifier when HEALTHCHECK_BASE_URL is set', async () => {
    process.env['HEALTHCHECK_BASE_URL'] = 'https://hc-ping.com';
    const { HealthcheckNotifier } = await import('../../src/collectors/healthcheck.js');
    const constructorSpy = vi.spyOn(HealthcheckNotifier.prototype, 'ping').mockResolvedValue(undefined);

    const { main } = await import('../../src/collectors/collect-cli.js');
    await main();

    constructorSpy.mockRestore();
  });
});
