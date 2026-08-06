'use server';

import { timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import createAction from '@/lib/server/actions/createAction';
import {
  buildSessionCookieValue,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from '@/lib/server/auth/session';

const ENCODER = new TextEncoder();

/**
 * Verify a submitted password against EDITOR_PASSWORD in constant time and,
 * on match, set the session cookie. On mismatch, throw a safe error — the
 * `createAction` wrapper normalises it into the canonical envelope.
 *
 * Caveat (intentional): server actions are still callable directly via their
 * generated action id. This gate only stops curious users without the
 * password, not a determined attacker. Real auth is out of scope.
 */
export const unlockEditor = createAction(
  z.object({ password: z.string().min(1) }),
  async ({ data }) => {
    const expected = process.env.EDITOR_PASSWORD;
    if (!expected) {
      throw new Error('Editor sin contraseña configurada');
    }
    const a = ENCODER.encode(data.password);
    const b = ENCODER.encode(expected);
    // Upfront length check is acceptable: the password length is short and
    // the cookie value is irrelevant to this branch. Equal-length inputs go
    // through the constant-time compare.
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error('Contraseña incorrecta');
    }

    const cookieStore = await cookies();
    cookieStore.set({
      name: SESSION_COOKIE_NAME,
      value: buildSessionCookieValue(),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    return { unlocked: true };
  },
);

/**
 * Unwrapped redirect-issuing action that clears the session cookie and
 * sends the user back to the home page. Stays outside `createAction` because
 * `redirect()` throws a framework signal the wrapper would swallow.
 */
export async function lockEditor(): Promise<never> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect('/');
}
