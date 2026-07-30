import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  cacheComponents: true,
  serverExternalPackages: ['konva'],
  // Painted cells are bundled into the autosave payload every minute. Heavy
  // scenarios (5k+ cells) blow past Next.js's default 1 MB Server Action body
  // limit; 100 MB gives wide headroom for default maps (70×30, 3 floors fully
  // painted ≈ 38 MB) and stress tests. The real fix is diff-based autosaves
  // (track added/removed cells since last save) — see memory observation
  // "pathfinder-diff-based-autosave". Once that's in, this limit can come
  // back down to a few MB.
  //
  // NOTE: In Next.js 16.2.x `serverActions` still lives under `experimental`
  // even though the docs surface it as a top-level key. Verified against
  // `node_modules/next/dist/server/config-shared.d.ts:656`.
  // FRAGILE: a future Next minor that promotes `serverActions` out of
  // `experimental` will silently drop this override and revert to the
  // default 1MB body limit. Watch Next release notes; re-verify on upgrade.
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
};

export default nextConfig;
