/**
 * Ambient module declaration for `stats.js` (mrdoob/stats.js, MIT). The package
 * ships a UMD bundle with no TypeScript types, so we declare the minimal shape
 * we consume inside `hud.ts` and `PerfHud.tsx`. The `dom` property is the root
 * container that the lib injects into `document.body`; we reparent it from
 * `hud.ts` so it stacks inside the PerfHud fixed panel.
 */
declare module 'stats.js' {
  export default class Stats {
    constructor(zero?: number);
    dom: HTMLDivElement;
    begin(): void;
    end(): number;
    update(): void;
    setMode(mode: number): void;
  }
}
