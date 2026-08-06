/**
 * Dev-only perf instrumentation. Not part of the runtime bundle for end users;
 * lives outside `lib/` per AGENTS.md §5 (which reserves `lib/` for server/shared
 * slices). Consumers import the helpers they need directly:
 *
 *   import { telemetry } from '@/dev/perf/telemetry';
 */
export { telemetry } from './telemetry';
