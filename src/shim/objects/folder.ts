import { TrufosRequest } from './request';
import { z } from 'zod';
import { TrufosId } from './id';

export const Folder = z.object({
  id: TrufosId,
  parentId: TrufosId,
  type: z.literal('folder'),
  lastModified: z.number(),
  title: z.string(),
  get children() {
    return z.union([Folder, TrufosRequest]).array();
  },
});
export type Folder = z.infer<typeof Folder>;
