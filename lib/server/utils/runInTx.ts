import type { Prisma, PrismaClient } from "@/generated/prisma/client";

/**
 * Returns a function that executes a callback within a transaction.
 * - If db is PrismaClient: wraps in $transaction
 * - If db is already TransactionClient: calls it directly (no-op wrapper)
 */
export const runInTx = (
  db: PrismaClient | Prisma.TransactionClient,
): (<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => Promise<T>) => {
  const canRunTx = "$transaction" in db && typeof (db as PrismaClient).$transaction === "function";

  if (canRunTx) {
    return <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) =>
      (db as PrismaClient).$transaction(fn);
  }

  return <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) =>
    fn(db as Prisma.TransactionClient);
};