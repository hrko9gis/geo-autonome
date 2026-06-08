import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { JsonlSaleRepository } from './sales/repository.js';
import { createWebhookServer } from './sales/webhook-server.js';

const SALES_FILE = path.join('data', 'sales.jsonl');
const DEFAULT_PORT = 8081;

export async function main(): Promise<void> {
  const port = parseInt(process.env['PORT'] ?? String(DEFAULT_PORT), 10);
  const saleRepo = new JsonlSaleRepository(SALES_FILE);
  const server = createWebhookServer(saleRepo);

  await new Promise<void>((resolve) => server.listen(port, '0.0.0.0', resolve));
  console.log(`[webhook-server-cli] Listening on port ${port}`);

  const shutdown = (): void => {
    console.log('[webhook-server-cli] Shutting down...');
    server.close(() => {
      console.log('[webhook-server-cli] Server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err: unknown) => {
    console.error('[webhook-server-cli] Unexpected error:', err);
    process.exit(1);
  });
}
