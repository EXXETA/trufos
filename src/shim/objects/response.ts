import { HttpHeaders } from 'shim/headers';
import z from 'zod';

export const ResponseSize = z.object({
  totalSizeInBytes: z.number(),
  headersSizeInBytes: z.number(),
  bodySizeInBytes: z.number(),
});
export type ResponseSize = z.infer<typeof ResponseSize>;

export const MetaInfo = z.object({
  duration: z.number(),
  size: ResponseSize,
  status: z.number(),
});
export type MetaInfo = z.infer<typeof MetaInfo>;

export const TrufosResponse = z.object({
  type: z.literal('response'),
  headers: HttpHeaders,
  metaInfo: MetaInfo,
  id: z.string(),
});
export type TrufosResponse = z.infer<typeof TrufosResponse>;
