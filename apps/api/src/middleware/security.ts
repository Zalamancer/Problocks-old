import type { Context, Next } from 'hono';

/**
 * Rate limiter — simple in-memory token bucket per IP.
 */
const rateLimits = new Map<string, { tokens: number; lastRefill: number }>();
const MAX_TOKENS = 60;       // requests per window
const REFILL_RATE = 1;       // tokens per second
const WINDOW_MS = 60_000;    // 1 minute

export async function rateLimiter(c: Context, next: Next) {
  const ip = c.req.header('x-forwarded-for') ?? c.req.header('cf-connecting-ip') ?? 'unknown';

  let bucket = rateLimits.get(ip);
  const now = Date.now();

  if (!bucket) {
    bucket = { tokens: MAX_TOKENS, lastRefill: now };
    rateLimits.set(ip, bucket);
  }

  // Refill tokens
  const elapsed = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(MAX_TOKENS, bucket.tokens + elapsed * REFILL_RATE);
  bucket.lastRefill = now;

  if (bucket.tokens < 1) {
    return c.json({ error: 'Too many requests. Try again later.' }, 429);
  }

  bucket.tokens -= 1;

  // Clean up old entries periodically
  if (rateLimits.size > 10000) {
    for (const [key, val] of rateLimits) {
      if (now - val.lastRefill > WINDOW_MS * 5) rateLimits.delete(key);
    }
  }

  await next();
}

/**
 * Security headers — prevents common web vulnerabilities.
 */
export async function securityHeaders(c: Context, next: Next) {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('X-XSS-Protection', '1; mode=block');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
}

/**
 * Input sanitizer — strips dangerous characters from string inputs.
 */
export function sanitizeString(input: string, maxLength = 500): string {
  return input
    .slice(0, maxLength)
    .replace(/[<>]/g, '')  // strip angle brackets (XSS prevention)
    .trim();
}

/**
 * Validate slug format — only lowercase letters, numbers, hyphens.
 */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) && slug.length <= 100;
}
