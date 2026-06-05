export const PRO_PRICE_USD = 9.99;
export const PRO_PRICE_BDT = 1099;

/** First origin from CORS_ORIGIN (comma-separated) or localhost dev default. */
export function getWebOrigin(): string {
  const raw = process.env.CORS_ORIGIN ?? process.env.WEB_URL ?? 'http://localhost:3000';
  return raw.split(',')[0].trim();
}

export function isStripeConfigured(): boolean {
  const key = process.env.STRIPE_SECRET_KEY ?? '';
  const price = process.env.STRIPE_PRO_PRICE_ID ?? '';
  return Boolean(key && price && !key.includes('placeholder') && !key.endsWith('...'));
}

export function isBinanceConfigured(): boolean {
  return Boolean(process.env.BINANCE_API_KEY && process.env.BINANCE_SECRET_KEY);
}

export function isSslcommerzConfigured(): boolean {
  return Boolean(process.env.SSLCOMMERZ_STORE_ID && process.env.SSLCOMMERZ_STORE_PASSWD);
}
