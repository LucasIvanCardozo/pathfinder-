import { useRouter } from "next/navigation";
import { startTransition, useCallback } from "react";

/**
 * Soft-refresh the current route.
 *
 * `startReload` triggers `router.refresh()` inside a `startTransition`, which
 * re-fetches the React Server Component payload for the current route without
 * adding a loading flash. Client state (`useState`, scroll position) is
 * preserved.
 *
 * IMPORTANT: this does NOT invalidate server-side cache. The matching write
 * action must call `updateTag('pathfinder:<entity>')` (and optionally
 * `revalidatePath`) so the cached read returns fresh data when the route
 * re-renders. See `docs/architecture/cache-tag-convention.md`.
 *
 * Usage:
 *   const { startReload } = useReload();
 *   const result = await someAction(values);
 *   if (result.success) startReload();
 */
export const useReload = () => {
  const { refresh } = useRouter();

  const startReload = useCallback(() => {
    startTransition(() => {
      refresh();
    });
  }, [refresh]);

  return { startReload };
};