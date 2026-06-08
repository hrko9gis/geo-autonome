export interface GumroadWebhookPayload {
  saleId: string;
  productId: string;
  priceUsd: number;
  currency: string;
  shortUrlId?: string;
}

export function parseGumroadWebhook(rawBody: string): GumroadWebhookPayload {
  const params = new URLSearchParams(rawBody);

  const saleId = params.get('sale_id');
  if (!saleId) {
    throw new Error('Missing sale_id in Gumroad webhook payload');
  }

  const urlParamsStr = params.get('url_params') ?? '';
  const shortUrlId = urlParamsStr
    ? (new URLSearchParams(urlParamsStr).get('_sa') ?? undefined)
    : undefined;

  const priceRaw = parseInt(params.get('price') ?? '0', 10);

  return {
    saleId,
    productId: params.get('product_id') ?? 'unknown',
    priceUsd: priceRaw / 100,
    currency: params.get('currency') ?? 'USD',
    shortUrlId,
  };
}
