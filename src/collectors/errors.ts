import type { CollectorSource } from './types.js';

export class CollectorError extends Error {
  constructor(
    message: string,
    public readonly source: CollectorSource,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'CollectorError';
  }
}
