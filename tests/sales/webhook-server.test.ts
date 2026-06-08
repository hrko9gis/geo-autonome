import http from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createWebhookServer } from '../../src/sales/webhook-server.js';
import { InMemorySaleRepository } from '../../src/sales/repository.js';

function makeRequest(
  server: http.Server,
  opts: { method: string; path: string; body?: string },
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const address = server.address() as { port: number };
    const bodyStr = opts.body ?? '';
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: address.port,
        path: opts.path,
        method: opts.method,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(bodyStr),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c: Buffer) => { data += c.toString(); });
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }));
      },
    );
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

describe('createWebhookServer', () => {
  let server: http.Server;
  let saleRepo: InMemorySaleRepository;

  beforeEach(async () => {
    saleRepo = new InMemorySaleRepository();
    server = createWebhookServer(saleRepo);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('GET /health returns 200 {"status":"ok"}', async () => {
    const res = await makeRequest(server, { method: 'GET', path: '/health' });
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ status: 'ok' });
  });

  it('POST /webhook/gumroad with valid body returns 200', async () => {
    const body = 'sale_id=s1&product_id=template-japan&price=1900&currency=USD';
    const res = await makeRequest(server, {
      method: 'POST',
      path: '/webhook/gumroad',
      body,
    });
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body).received).toBe(true);
  });

  it('POST /webhook/gumroad saves a Sale record', async () => {
    const body = 'sale_id=s1&product_id=template-japan&price=1900&currency=USD';
    await makeRequest(server, {
      method: 'POST',
      path: '/webhook/gumroad',
      body,
    });

    const sales = await saleRepo.findAll();
    expect(sales).toHaveLength(1);
    expect(sales[0].productId).toBe('template-japan');
    expect(sales[0].amountUsd).toBe(19);
    expect(sales[0].platform).toBe('gumroad');
  });

  it('POST /webhook/gumroad records shortUrlId from _sa param', async () => {
    const urlParams = encodeURIComponent('_sa=abc123');
    const body = `sale_id=s1&product_id=p1&price=1900&currency=USD&url_params=${urlParams}`;
    await makeRequest(server, {
      method: 'POST',
      path: '/webhook/gumroad',
      body,
    });

    const sales = await saleRepo.findAll();
    expect(sales[0].shortUrlId).toBe('abc123');
  });

  it('POST /webhook/gumroad without sale_id returns 400', async () => {
    const res = await makeRequest(server, {
      method: 'POST',
      path: '/webhook/gumroad',
      body: 'product_id=p1&price=1900',
    });
    expect(res.status).toBe(400);
  });

  it('unknown route returns 404', async () => {
    const res = await makeRequest(server, { method: 'GET', path: '/unknown' });
    expect(res.status).toBe(404);
  });
});
