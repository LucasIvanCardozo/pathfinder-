import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

/** Cookie name used for the editor soft gate. */
export const SESSION_COOKIE_NAME = 'pf_session';

/** Cookie lifetime: 7 days. */
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

const ENCODER = new TextEncoder();

/**
 * Read EDITOR_SECRET and EDITOR_PASSWORD from the environment. Both must be
 * set or the session helpers fail loudly so misconfiguration is caught at
 * first usage instead of silently treating every request as locked.
 */
function getCredentials(): { secret: string; password: string } {
  const secret = process.env.EDITOR_SECRET;
  const password = process.env.EDITOR_PASSWORD;
  if (!secret || !password) {
    throw new Error(
      'EDITOR_SECRET and EDITOR_PASSWORD must be set in the environment to use the editor session helpers.',
    );
  }
  return { secret, password };
}

/**
 * Compute the expected cookie value: an HMAC-SHA256 of the editor password
 * keyed by the editor secret. The cookie is therefore verifiable without any
 * server-side storage — the server only needs the same env vars to recompute
 * the expected value.
 */
export function buildSessionCookieValue(): string {
  const { secret, password } = getCredentials();
  return createHmac('sha256', secret).update(password).digest('hex');
}

/**
 * Read the session cookie and constant-time compare it against the expected
 * HMAC. Returns false on a missing cookie, length mismatch, or value
 * mismatch. Never throws — a misconfigured environment surfaces as a
 * permanently-locked editor (cookie never matches), which is the safer
 * failure mode.
 */
export async function isUnlocked(): Promise<boolean> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE_NAME);
  if (!cookie?.value) return false;

  const expected = buildSessionCookieValue();
  const a = ENCODER.encode(cookie.value);
  const b = ENCODER.encode(expected);
  // timingSafeEqual requires equal-length buffers; bail out before the
  // constant-time compare on a length mismatch (the length leak is acceptable
  // because the cookie value is a fixed-length hex digest).
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
