import { z } from 'zod';
import { HttpHeaders } from './headers';
import { MetaInfo } from './objects/response';
import { RequestMethod } from './objects/request-method';
import { ScriptType } from './scripting';

/** Maximum number of entries kept in the request history. Older entries are evicted. */
export const MAX_HISTORY_ENTRIES = 100;

/** A body stored in a temporary file of the main process. It can be streamed by its ID. */
export const StoredBody = z.object({
  id: z.string(),
  size: z.number(),
});
export type StoredBody = z.infer<typeof StoredBody>;

/** A console call or error of a user script. */
export const ScriptLog = z.object({
  script: z.enum(ScriptType).optional(),
  level: z.enum(['info', 'debug', 'warn', 'error']),
  args: z.array(z.unknown()),
});
export type ScriptLog = z.infer<typeof ScriptLog>;

/** A request exactly as it was sent, with all variables resolved. */
export const SentRequest = z.object({
  method: z.string(),
  url: z.string(),
  headers: HttpHeaders,
  body: StoredBody.optional(),
});
export type SentRequest = z.infer<typeof SentRequest>;

export const ReceivedResponse = z.object({
  headers: HttpHeaders,
  metaInfo: MetaInfo,
  body: StoredBody.optional(),
});
export type ReceivedResponse = z.infer<typeof ReceivedResponse>;

/** What is shown in the history list. Kept small so the list loads fast. */
export const HistoryEntrySummary = z.object({
  id: z.string(),
  requestId: z.string(),
  requestTitle: z.string(),
  timestamp: z.number(),
  method: z.enum(RequestMethod),
  /** The resolved URL if the request was sent, the URL template otherwise. */
  url: z.string(),
  status: z.number().optional(),
  duration: z.number().optional(),
  /** Set if no response was received. */
  error: z.string().optional(),
});
export type HistoryEntrySummary = z.infer<typeof HistoryEntrySummary>;

/**
 * A request/response pair or a request/error pair, including the output of the request's
 * scripts. Contains secrets on purpose, so it must never be written to the app log.
 */
export const HistoryEntry = HistoryEntrySummary.extend({
  /** Missing if the request failed before it was sent, e.g. because of an undefined variable. */
  request: SentRequest.optional(),
  response: ReceivedResponse.optional(),
  scriptLogs: z.array(ScriptLog),
});
export type HistoryEntry = z.infer<typeof HistoryEntry>;
