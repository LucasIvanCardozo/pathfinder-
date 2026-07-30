import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // Subdivisions are now a hardcoded const in `lib/shared/types/subdivision.types.ts`
    // and live in the schema for backwards compatibility of the FK reference on
    // `PaintedCell.subdivisionId`. No seed step is needed.
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
