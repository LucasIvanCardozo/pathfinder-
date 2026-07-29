'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { z } from 'zod';
import createAction from '@/lib/server/actions/createAction';
import { subdivisionUseCases } from '@/lib/server/useCases';
import { SubdivisionConfigInputSchema } from '@/lib/shared/schemas/subdivision.schemas';

/** Cached piece catalog used by the admin gallery. */
export const listAllPieces = createAction(null, async () => subdivisionUseCases.getAllPieces());

/** Cached list of subdivisions. */
export const listSubdivisions = createAction(null, async () => subdivisionUseCases.list());

/** Create a subdivision. */
export const createSubdivision = createAction(
  SubdivisionConfigInputSchema,
  async ({ data, db }) => {
    const sub = await subdivisionUseCases.create(db, data);
    updateTag('pathfinder:subdivisions');
    revalidatePath('/editor');
    return sub;
  },
);

/** Update a subdivision by id. The id travels alongside the input payload. */
export const updateSubdivision = createAction(
  z.object({ id: z.string().min(1) }).extend(SubdivisionConfigInputSchema.shape),
  async ({ data, db }) => {
    const { id, ...input } = data;
    const sub = await subdivisionUseCases.update(db, id, input);
    updateTag('pathfinder:subdivisions');
    revalidatePath('/editor');
    return sub;
  },
);

/** Delete a subdivision. Throws when something still references it; the
 *  wrapper normalises the throw into the canonical envelope. */
export const deleteSubdivision = createAction(
  z.object({ id: z.string().min(1) }),
  async ({ data, db }) => {
    await subdivisionUseCases.delete(db, data.id);
    updateTag('pathfinder:subdivisions');
    revalidatePath('/editor');
    return { id: data.id };
  },
);

/** Reorder subdivisions. The repository composes a transaction. */
export const reorderSubdivisions = createAction(
  z.array(z.object({ id: z.string().min(1), order: z.number().int().min(0).max(20) })),
  async ({ data, db }) => {
    await subdivisionUseCases.reorder(db, data);
    updateTag('pathfinder:subdivisions');
    revalidatePath('/editor');
  },
);
