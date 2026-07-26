// Transitional bridge: default-export the existing src/db singleton so the
// root-level `lib/server/db/db.ts` target can be wired up before the
// env/pool/PrismaPg adapter migration lands. Replace with the real singleton
// (env + Pool + PrismaPg + global cache) once the Prisma client path moves.
import { prisma } from '@/db';

export default prisma;
