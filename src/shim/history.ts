import { z } from 'zod';
import { HttpHeaders } from './headers';
import { LogLevel } from './logger';
import { MetaInfo } from './objects/response';
import { RequestMethod } from './objects/request-method';
import { ScriptType } from './scripting';

/** Maximum number of entries kept in the request history. Older entries are evicted. */
export const MAX_HISTORY_ENTRIES = 100;

/** A body stored in an encrypted temporary file of the main process, streamed by its ID. */
export const StoredBody = z.object({
  id: z.string(),
  size: z.number(),
});
export type StoredBody = z.infer<typeof StoredBody>;

/** A console call or error of a user script. */
export const ScriptLog = z.object({
  script: z.enum(ScriptType),
  level: LogLevel,
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

/** How a request ended: with a response, with an error, or because the user aborted it. */
export const HistoryOutcome = z.discriminatedUnion('type', [
  z.object({ type: z.literal('response'), response: ReceivedResponse }),
  z.object({ type: z.literal('error'), message: z.string() }),
  z.object({ type: z.literal('aborted') }),
]);
export type HistoryOutcome = z.infer<typeof HistoryOutcome>;

/**
 * A request/response pair or a request/error pair, including the output of the request's
 * scripts. Contains secrets on purpose, so it must never be written to the app log.
 */
export const HistoryEntry = z.object({
  id: z.string(),
  requestId: z.string(),
  requestTitle: z.string(),
  timestamp: z.number(),
  method: z.enum(RequestMethod),
  /** The resolved URL if the request was sent, the URL template otherwise. */
  url: z.string(),
  /** Missing if the request failed before it was sent, e.g. because of an undefined variable. */
  request: SentRequest.optional(),
  outcome: HistoryOutcome,
  scriptLogs: z.array(ScriptLog),
});
export type HistoryEntry = z.infer<typeof HistoryEntry>;

/** What is shown in the history list. Kept small so the list loads fast. */
export const HistoryEntrySummary = HistoryEntry.pick({
  id: true,
  requestId: true,
  requestTitle: true,
  timestamp: true,
  method: true,
  url: true,
}).extend({
  status: z.number().optional(),
  duration: z.number().optional(),
  /** Set if the request failed. */
  error: z.string().optional(),
  /** Set if the user aborted the request. */
  aborted: z.boolean().optional(),
});
export type HistoryEntrySummary = z.infer<typeof HistoryEntrySummary>;

/**
 * Derives the list summary of an entry.
 * @param entry the entry, of which only the fields shown in the list are needed
 */
export function summarizeHistoryEntry(
  entry: Pick<
    HistoryEntry,
    'id' | 'requestId' | 'requestTitle' | 'timestamp' | 'method' | 'url' | 'outcome'
  >
): HistoryEntrySummary {
  const { id, requestId, requestTitle, timestamp, method, url, outcome } = entry;
  const base = { id, requestId, requestTitle, timestamp, method, url };
  switch (outcome.type) {
    case 'error':
      return { ...base, error: outcome.message };
    case 'aborted':
      return { ...base, aborted: true };
    case 'response': {
      const { status, duration } = outcome.response.metaInfo;
      return { ...base, status, duration };
    }
  }
}
