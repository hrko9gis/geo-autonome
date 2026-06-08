import { describe, expect, it, vi } from 'vitest';
import { withRetry } from '../../src/shared/retry.js';

describe('withRetry()', () => {
  it('calls fn once when it succeeds on the first attempt', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await withRetry(fn, 3, []);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledOnce();
  });

  it('retries and succeeds on the 3rd attempt', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('attempt 1 fail'))
      .mockRejectedValueOnce(new Error('attempt 2 fail'))
      .mockResolvedValueOnce('success');

    const result = await withRetry(fn, 3, [0, 0]);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws the last error after exhausting all attempts', async () => {
    const lastErr = new Error('final failure');
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('attempt 1'))
      .mockRejectedValueOnce(new Error('attempt 2'))
      .mockRejectedValueOnce(lastErr);

    await expect(withRetry(fn, 3, [0, 0])).rejects.toThrow('final failure');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('works with maxAttempts=1 (no retries)', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));
    await expect(withRetry(fn, 1, [])).rejects.toThrow('fail');
    expect(fn).toHaveBeenCalledOnce();
  });

  it('works with empty delays (immediate retry)', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce('ok');
    const result = await withRetry(fn, 2, []);
    expect(result).toBe('ok');
  });

  it('uses default maxAttempts=3 when not specified', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('a'))
      .mockRejectedValueOnce(new Error('b'))
      .mockRejectedValueOnce(new Error('c'));

    await expect(withRetry(fn, 3, [0, 0])).rejects.toBeDefined();
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
