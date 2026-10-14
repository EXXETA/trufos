import { z } from 'zod';

/** The ID of a collection, folder or request. */
export const TrufosId = z.string().min(1);
export type TrufosId = z.infer<typeof TrufosId>;
