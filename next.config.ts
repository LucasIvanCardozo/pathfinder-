import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  cacheComponents: true,
  serverExternalPackages: ['konva'],
  // The autosave pipeline is diff-based: subsequent saves ship only `ops`
  // (changes since the last save, drained from `useOpsBuffer`) — see
  // `use-scenario-autosave.ts` and `scenarioOp.schemas.ts`. The full
  // `paintedCells` only travels on the FIRST save, when `scenarioId === null`
  // and the server seeds the scenario. 10 MB is enough headroom for both paths:
  // every-minute autosaves are tiny (ops only), and first saves typically start
  // with few painted cells. The previous 100 MB ceiling was sized for an older
  // full-map-every-minute model that the current code no longer implements.
  //
  // NOTE: In Next.js 16.2.x `serverActions` still lives under `experimental`
  // even though the docs surface it as a top-level key. Verified against
  // `node_modules/next/dist/server/config-shared.d.ts:656`.
  // FRAGILE: a future Next minor that promotes `serverActions` out of
  // `experimental` will silently drop this override and revert to the
  // default 1MB body limit. Watch Next release notes; re-verify on upgrade.
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
