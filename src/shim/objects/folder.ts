import { TrufosRequest } from './request';
import z from 'zod';

export const Folder = z.object({
  id: z.string(),
  parentId: z.string(),
  type: z.literal('folder'),
  title: z.string(),
  get children() {
    return z.union([Folder, TrufosRequest]).array();
  },
});
export type Folder = z.infer<typeof Folder>;
