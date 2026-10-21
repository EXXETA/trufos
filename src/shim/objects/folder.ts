import { TrufosRequest } from './request';
import { z } from 'zod';
import { TrufosId } from './id';
import { AuthorizationInformationNoInherit } from './auth';
import { TrufosHeader } from './headers';

export const Folder = z.object({
  id: TrufosId,
  parentId: TrufosId,
  type: z.literal('folder'),
  lastModified: z.number(),
  title: z.string(),
  /** The authorization of the requests that inherit theirs. If not set, the folder inherits it. */
  auth: AuthorizationInformationNoInherit.optional(),
  /** The headers of the requests inside the folder. They override those of outer levels. */
  headers: TrufosHeader.array().optional(),
  get children() {
    return z.union([Folder, TrufosRequest]).array();
  },
});
export type Folder = z.infer<typeof Folder>;
