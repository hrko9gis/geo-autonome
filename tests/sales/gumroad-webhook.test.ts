import { describe, expect, it } from 'vitest';
import { parseGumroadWebhook } from '../../src/sales/gumroad-webhook.js';

describe('parseGumroadWebhook()', () => {
  it('parses sale_id, product_id, price, currency', () => {
    const body = 'sale_id=sale123&product_id=template-japan&price=1900&currency=USD';
    const result = parseGumroadWebhook(body);
    expect(result.saleId).toBe('sale123');
    expect(result.productId).toBe('template-japan');
    expect(result.priceUsd).toBe(19);
    expect(result.currency).toBe('USD');
  });

  it('converts price from cents to USD', () => {
    const body = 'sale_id=s1&price=2999&currency=USD';
    const result = parseGumroadWebhook(body);
    expect(result.priceUsd).toBe(29.99);
  });

  it('extracts _sa parameter as shortUrlId from url_params', () => {
    const urlParams = encodeURIComponent('_sa=abc123&ref=twitter');
    const body = `sale_id=s1&product_id=p1&price=1900&currency=USD&url_params=${urlParams}`;
    const result = parseGumroadWebhook(body);
    expect(result.shortUrlId).toBe('abc123');
  });

  it('returns undefined shortUrlId when url_params has no _sa', () => {
    const urlParams = encodeURIComponent('ref=twitter');
    const body = `sale_id=s1&product_id=p1&price=1900&currency=USD&url_params=${urlParams}`;
    const result = parseGumroadWebhook(body);
    expect(result.shortUrlId).toBeUndefined();
  });

  it('returns undefined shortUrlId when url_params is absent', () => {
    const body = 'sale_id=s1&product_id=p1&price=1900&currency=USD';
    const result = parseGumroadWebhook(body);
    expect(result.shortUrlId).toBeUndefined();
  });

  it('throws when sale_id is missing', () => {
    expect(() => parseGumroadWebhook('product_id=p1&price=1900&currency=USD')).toThrow(
      'Missing sale_id',
    );
  });

  it('parses other fields even with minimal valid body', () => {
    const result = parseGumroadWebhook('sale_id=s1');
    expect(result.priceUsd).toBe(0);
    expect(result.currency).toBe('USD');
    expect(result.productId).toBe('unknown');
  });
});
