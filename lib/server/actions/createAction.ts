import z from 'zod';
import type { PrismaClient } from '@/generated/prisma/client';
import { capitalize } from '@/lib/shared/utils/capitalize';

export default function createAction<T extends z.Schema, K>(
  schema: T | null,
  callback: (context: { data: z.infer<T>; db: PrismaClient }) => Promise<K>,
): CreateActionResponse<z.infer<T>, K> {
  return async (values) => {
    try {
      const parsed = schema?.parse(values) ?? values;

      const db = (await import('@/lib/server/db/db')).default;

      const data = await callback({
        data: parsed,
        db,
      });

      return {
        success: true,
        data,
        error: null,
      };
    } catch (error) {
      const err = error as Error;
      if (error instanceof z.ZodError)
        return {
          success: false,
          data: null,
          error: {
            message: error.errors.map(({ path, message }) => `${path} 🡆 ${message}`).join('\n'),
          },
        };

      console.error('[createAction] Unhandled error:', error);
      return {
        success: false,
        data: null,
        error: {
          message: capitalize(err.message),
          cause: err.cause as string | undefined,
        },
      };
    }
  };
}

export type CreateActionResponse<TValue, TData> = (
  values?: TValue | Record<string, unknown>,
) => Promise<ActionResult<TData>>;

export type ActionResult<TData> =
  | {
      success: true;
      data: TData;
      error: null;
    }
  | {
      success: false;
      data: null;
      error: { message: string; cause?: string };
    };
