import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', () => ({
  appendFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(''),
}));

const mockListen = vi.fn((_port: number, _host: string, cb: () => void) => { cb(); });

vi.mock('../src/sales/webhook-server.js', () => ({
  createWebhookServer: vi.fn().mockReturnValue({
    listen: mockListen,
    close: vi.fn((cb: () => void) => { cb(); }),
  }),
}));

describe('webhook-server-cli main()', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((_code) => {
      throw new Error(`process.exit(${_code ?? 'undefined'})`);
    });
    mockListen.mockClear();
  });

  afterEach(() => {
    exitSpy.mockRestore();
    vi.clearAllMocks();
  });

  it('starts the server on the default port', async () => {
    const { main } = await import('../src/webhook-server-cli.js');
    await main();
    expect(mockListen).toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalledWith(1);
  });
});
