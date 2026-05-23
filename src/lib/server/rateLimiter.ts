const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;

const hits = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  ip: string,
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = hits.get(ip);

  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: MAX_REQUESTS - 1, resetAt: now + WINDOW_MS };
  }

  entry.count += 1;
  if (entry.count > MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  return { allowed: true, remaining: MAX_REQUESTS - entry.count, resetAt: entry.resetAt };
}

export function rateLimitHeaders(ip: string): Record<string, string> {
  const { allowed, remaining, resetAt } = checkRateLimit(ip);
  const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
  return {
    "x-ratelimit-limit": String(MAX_REQUESTS),
    "x-ratelimit-remaining": String(remaining),
    "x-ratelimit-reset": String(Math.ceil(resetAt / 1000)),
    ...(allowed ? {} : { "retry-after": String(retryAfter) }),
  };
}
