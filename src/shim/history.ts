import { z } from 'zod';
import { HttpHeaders } from './objects/headers';
import { LogLevel } from './logger';
import { ReceivedResponse, StoredBody } from './objects/response';
import { RequestMethod } from './objects/request-method';
import { ScriptType } from './scripting';

/**
 * Maximum number of entries kept in the request history of all collections together. Older entries
 * are evicted.
 */
export const MAX_HISTORY_ENTRIES = 100;

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

/** The outcome as shown in the history list, without headers and bodies. */
export const HistoryOutcomeSummary = z.discriminatedUnion('type', [
  z.object({ type: z.literal('response'), status: z.number(), duration: z.number() }),
  z.object({ type: z.literal('error'), message: z.string() }),
  z.object({ type: z.literal('aborted') }),
]);
export type HistoryOutcomeSummary = z.infer<typeof HistoryOutcomeSummary>;

/** What is shown in the history list. Kept small so the list loads fast. */
export const HistoryEntrySummary = HistoryEntry.pick({
  id: true,
  requestId: true,
  requestTitle: true,
  timestamp: true,
  method: true,
  url: true,
}).extend({
  outcome: HistoryOutcomeSummary,
});
export type HistoryEntrySummary = z.infer<typeof HistoryEntrySummary>;

/**
 * @param outcome the outcome of a request
 * @returns the outcome as shown in the history list
 */
export function summarizeHistoryOutcome(outcome: HistoryOutcome): HistoryOutcomeSummary {
  if (outcome.type !== 'response') return outcome;
  const { status, duration } = outcome.response.metaInfo;
  return { type: 'response', status, duration };
}

/**
 * Derives the list summary of an entry.
 * @param entry the entry
 */
export function summarizeHistoryEntry(entry: HistoryEntry): HistoryEntrySummary {
  const { id, requestId, requestTitle, timestamp, method, url, outcome } = entry;
  return {
    id,
    requestId,
    requestTitle,
    timestamp,
    method,
    url,
    outcome: summarizeHistoryOutcome(outcome),
  };
}
