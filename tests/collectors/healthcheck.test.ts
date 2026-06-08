import { afterEach, describe, expect, it, vi } from 'vitest';
import { HealthcheckNotifier, NoopHealthcheckNotifier } from '../../src/collectors/healthcheck.js';

describe('HealthcheckNotifier', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('ping() fetches GET {baseUrl}/{uuid}', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 200 }));
    const notifier = new HealthcheckNotifier('https://hc-ping.com');

    await notifier.ping('test-uuid-123');

    expect(fetchSpy).toHaveBeenCalledWith('https://hc-ping.com/test-uuid-123');
  });

  it('fail() fetches POST {baseUrl}/{uuid}/fail with message body', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 200 }));
    const notifier = new HealthcheckNotifier('https://hc-ping.com');

    await notifier.fail('test-uuid-123', 'collector failed');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://hc-ping.com/test-uuid-123/fail',
      expect.objectContaining({
        method: 'POST',
        body: 'collector failed',
      }),
    );
  });

  it('ping() does not throw on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));
    const notifier = new HealthcheckNotifier();

    await expect(notifier.ping('test-uuid-123')).resolves.toBeUndefined();
  });

  it('fail() does not throw on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));
    const notifier = new HealthcheckNotifier();

    await expect(notifier.fail('test-uuid-123', 'error message')).resolves.toBeUndefined();
  });

  it('uses default baseUrl if not provided', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 200 }));
    const notifier = new HealthcheckNotifier();

    await notifier.ping('uuid-abc');

    expect(fetchSpy).toHaveBeenCalledWith('https://hc-ping.com/uuid-abc');
  });
});

describe('NoopHealthcheckNotifier', () => {
  it('ping() resolves without calling fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const notifier = new NoopHealthcheckNotifier();

    await notifier.ping('any-uuid');

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fail() resolves without calling fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const notifier = new NoopHealthcheckNotifier();

    await notifier.fail('any-uuid', 'any message');

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
