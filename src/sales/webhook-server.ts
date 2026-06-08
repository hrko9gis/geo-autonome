import http from 'node:http';
import type { GumroadWebhookPayload } from './gumroad-webhook.js';
import { parseGumroadWebhook } from './gumroad-webhook.js';
import type { ISaleRepository } from './repository.js';

const MAX_BODY_SIZE = 1024 * 1024; // 1MB

function jsonResponse(res: http.ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(body);
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        reject(new Error('Request body too large'));
        return;
      }
      data += chunk.toString();
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export function createWebhookServer(saleRepo: ISaleRepository): http.Server {
  return http.createServer(async (req, res) => {
    const method = req.method ?? 'GET';
    const url = req.url ?? '/';

    if (method === 'GET' && url === '/health') {
      return jsonResponse(res, 200, { status: 'ok' });
    }

    if (method === 'POST' && url === '/webhook/gumroad') {
      let rawBody: string;
      try {
        rawBody = await readBody(req);
      } catch {
        return jsonResponse(res, 400, { error: 'Failed to read request body' });
      }

      let payload: GumroadWebhookPayload;
      try {
        payload = parseGumroadWebhook(rawBody);
      } catch {
        return jsonResponse(res, 400, { error: 'Failed to parse webhook payload' });
      }

      const sale = {
        id: crypto.randomUUID(),
        productId: payload.productId,
        platform: 'gumroad' as const,
        amountUsd: payload.priceUsd,
        currency: payload.currency,
        shortUrlId: payload.shortUrlId,
        soldAt: new Date(),
      };

      try {
        await saleRepo.save(sale);
      } catch {
        return jsonResponse(res, 500, { error: 'Failed to save sale' });
      }

      return jsonResponse(res, 200, { received: true, saleId: sale.id });
    }

    return jsonResponse(res, 404, { error: 'Not found' });
  });
}
