import { z } from 'zod';
import { RequestMethod } from './request-method';
import { TrufosHeader } from './headers';

export const HistoryEntry = z.object({
  id: z.string(),
  timestamp: z.number(), // timestamp as unix epoch ms
  request: z.object({
    url: z.string(),
    method: z.enum(RequestMethod),
    headers: z.array(TrufosHeader),
    bodySummary: z.string().optional(),
  }),
  response: z.object({
    status: z.number(),
    duration: z.number(), // in ms
    size: z.number(), // in bytes
    error: z.string().optional(),
  }),
  sourceRequestId: z.string().optional(),
  sourceRequestTitle: z.string().optional(),
});
export type HistoryEntry = z.infer<typeof HistoryEntry>;
