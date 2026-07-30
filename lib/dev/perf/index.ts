/**
 * Barrel for the dev-only performance instrumentation module. Each public
 * export is guarded internally against `process.env.NODE_ENV === 'production'`,
 * so consumers can mount `<PerfHud />` and `<BenchmarkPanel />` unconditionally
 * without paying any runtime cost in production builds.
 */

export { BenchmarkPanel } from './BenchmarkPanel';
export type { Scenario, ScenarioCtx } from './benchmark';
export { exportScenarios, runScenario } from './benchmark';
export { PerfHud } from './PerfHud';
export type {
  FpsStat,
  PerfSnapshot,
  RenderStat,
} from './telemetry';
export { telemetry } from './telemetry';
