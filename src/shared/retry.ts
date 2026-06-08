export const DEFAULT_DELAYS_MS = [1000, 4000, 16000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  delays: number[] = DEFAULT_DELAYS_MS,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts - 1 && attempt < delays.length) {
        await sleep(delays[attempt] ?? 0);
      }
    }
  }
  throw lastError;
}
