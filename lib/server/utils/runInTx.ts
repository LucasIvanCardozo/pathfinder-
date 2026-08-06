import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { TX_MAX_WAIT_MS, TX_TIMEOUT_MS } from '@/lib/shared/constants/timing';

/**
 * Returns a function that executes a callback within a transaction.
 * - If db is PrismaClient: wraps in $transaction
 * - If db is already TransactionClient: calls it directly (no-op wrapper)
 *
 * The explicit `timeout` is load-bearing: Prisma defaults interactive
 * transactions to 5 s, which `applyOpsInTx` exceeds on remote DBs once an
 * autosave batch grows past a few hundred sequential ops.
 */
export const runInTx = (
  db: PrismaClient | Prisma.TransactionClient,
): (<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => Promise<T>) => {
  const canRunTx = '$transaction' in db && typeof (db as PrismaClient).$transaction === 'function';

  if (canRunTx) {
    return <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) =>
      (db as PrismaClient).$transaction(fn, {
        maxWait: TX_MAX_WAIT_MS,
        timeout: TX_TIMEOUT_MS,
      });
  }

  return <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) =>
    fn(db as Prisma.TransactionClient);
};
