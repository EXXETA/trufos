import { HttpHeaders } from './headers';
import { z } from 'zod';

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

/** A body stored in an encrypted temporary file of the main process, streamed by its ID. */
export const StoredBody = z.object({
  id: z.string(),
  size: z.number(),
});
export type StoredBody = z.infer<typeof StoredBody>;

/** A received response. Its body is only referenced, as it may be large and contain secrets. */
export const ReceivedResponse = z.object({
  headers: HttpHeaders,
  metaInfo: MetaInfo,
  /** Missing if the response has no body. */
  body: StoredBody.optional(),
});
export type ReceivedResponse = z.infer<typeof ReceivedResponse>;

export const TrufosResponse = ReceivedResponse.extend({
  type: z.literal('response'),
});
export type TrufosResponse = z.infer<typeof TrufosResponse>;
