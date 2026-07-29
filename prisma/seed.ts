import 'dotenv/config';
import { subdivisionUseCases } from '@/lib/server/useCases';

/**
 * Idempotent default subdivision seed. Runs after every `prisma migrate dev`
 * via the `db:migrate:local` script. Safe to invoke manually via
 * `prisma db seed`.
 *
 * The seed payload lives in `lib/shared/types/subdivision.types.ts` so the
 * Prisma seed and the app-side repair path (`subdivisionUseCases.seedDefaults`)
 * use the same source of truth.
 */
async function main() {
  const db = (await import('@/lib/server/db/db')).default;
  await subdivisionUseCases.seedDefaults(db);
}

main()
  .then(async () => {
    const db = (await import('@/lib/server/db/db')).default;
    await db.$disconnect();
  })
  .catch(async (e) => {
    console.error('Seed failed:', e instanceof Error ? e.message : 'Unknown error');
    const db = (await import('@/lib/server/db/db')).default;
    await db.$disconnect();
    process.exit(1);
  });
