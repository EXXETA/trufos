import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { inspect } from 'node:util';
import { BodyStore } from 'main/network/service/body-store';
import type { BodyCopy } from 'main/network/service/request-body-copy';
import {
  HistoryEntry,
  HistoryEntrySummary,
  HistoryOutcome,
  MAX_HISTORY_ENTRIES,
  ReceivedResponse,
  ScriptLog,
  SentRequest,
  summarizeHistoryEntry,
} from 'shim/history';
import { TrufosRequest } from 'shim/objects/request';
import { TrufosResponse } from 'shim/objects/response';
import { buildUrl } from 'shim/objects/url';

const bodyStore = BodyStore.instance;

/** Event signatures emitted by the {@link HistoryService}. */
type HistoryServiceEvents = {
  changed: [];
};

/** What is captured while a request runs, before its entry is stored. */
interface InFlight {
  request: TrufosRequest;
  timestamp: number;
  sent?: Omit<SentRequest, 'body'>;
  body?: BodyCopy;
  scriptLogs: ScriptLog[];
}

/**
 * Keeps the request history of the current session: every sent request with its response or
 * error and the output of its scripts. Bodies are kept in the {@link BodyStore}, which the history
 * retains for as long as an entry references them.
 *
 * Everything that happens while a request is sent is attributed to it through an
 * {@link AsyncLocalStorage} context, see {@link record}. Entries contain secrets on purpose and
 * must never be written to the app log. The history is not persisted.
 */
export class HistoryService extends EventEmitter<HistoryServiceEvents> {
  public static readonly instance = new HistoryService();

  private readonly context = new AsyncLocalStorage<InFlight>();

  /** All entries, oldest first. */
  private readonly entries: HistoryEntry[] = [];

  /**
   * Sends a request and records it in the history.
   * @param request the request that is sent
   * @param send sends the request and resolves with its response, or `null` if it was aborted
   * @returns the result of `send`
   */
  async record(
    request: TrufosRequest,
    send: () => Promise<TrufosResponse | null>
  ): Promise<TrufosResponse | null> {
    const inFlight: InFlight = { request, timestamp: Date.now(), scriptLogs: [] };

    let response: TrufosResponse | null;
    try {
      response = await this.context.run(inFlight, send);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.store(inFlight, { type: 'error', message });
      throw error;
    }

    const outcome: HistoryOutcome =
      response == null
        ? { type: 'aborted' }
        : { type: 'response', response: toReceivedResponse(response) };
    await this.store(inFlight, outcome);
    return response;
  }

  /**
   * Records the request that is currently recorded exactly as it is sent.
   * @param sent the method, resolved URL and headers of the sent request
   * @param body the copy of the sent body, see `copyRequestBody`
   */
  recordSentRequest(sent: Omit<SentRequest, 'body'>, body?: BodyCopy): void {
    const inFlight = this.context.getStore();
    if (inFlight == null) {
      // nothing is recorded, so nobody would ever release the copy
      if (body != null) bodyStore.remove(body.id);
      return;
    }
    inFlight.sent = sent;
    inFlight.body = body;
  }

  /**
   * Records a console call or error of a user script for the request that is currently recorded.
   * @param log the script output
   */
  recordScriptLog(log: ScriptLog): void {
    this.context.getStore()?.scriptLogs.push({ ...log, args: log.args.map(toCloneable) });
  }

  /** Lists all entries, newest first. */
  list(): HistoryEntrySummary[] {
    return this.entries.map(summarizeHistoryEntry).reverse();
  }

  /**
   * Returns the entry with the given ID.
   * @param id the ID of the entry
   */
  get(id: string): HistoryEntry | undefined {
    return this.entries.find((entry) => entry.id === id);
  }

  /** Removes all entries and releases their bodies. */
  clear(): void {
    for (const entry of this.entries.splice(0)) {
      forEachBody(entry, (id) => bodyStore.release(id));
    }
    this.emit('changed');
  }

  /** Stores the entry of a finished request once the copy of its body is complete. */
  private async store(
    { request, timestamp, sent, body, scriptLogs }: InFlight,
    outcome: HistoryOutcome
  ) {
    // the request is finished, so whatever of the body was not sent yet will never be sent
    body?.cancel();
    await body?.done;

    this.add({
      id: randomUUID(),
      requestId: request.id,
      requestTitle: request.title,
      timestamp,
      method: request.method,
      url: sent?.url ?? buildUrl(request.url),
      request:
        sent != null
          ? { ...sent, body: body && { id: body.id, size: bodyStore.getSize(body.id) ?? 0 } }
          : undefined,
      outcome,
      scriptLogs,
    });
  }

  private add(entry: HistoryEntry) {
    forEachBody(entry, (id) => bodyStore.retain(id));
    this.entries.push(entry);
    while (this.entries.length > MAX_HISTORY_ENTRIES) {
      forEachBody(this.entries.shift()!, (id) => bodyStore.release(id));
    }
    this.emit('changed');
  }
}

function forEachBody({ request, outcome }: HistoryEntry, callback: (id: string) => void) {
  const requestBody = request?.body?.id;
  const responseBody = outcome.type === 'response' ? outcome.response.body?.id : undefined;
  if (requestBody != null) callback(requestBody);
  if (responseBody != null) callback(responseBody);
}

function toReceivedResponse({ headers, metaInfo, id }: TrufosResponse): ReceivedResponse {
  return {
    headers,
    metaInfo,
    body: id != null ? { id, size: metaInfo.size.bodySizeInBytes } : undefined,
  };
}

/**
 * Entries are sent to the renderer via IPC, which uses the structured clone algorithm and rejects
 * values like functions or symbols. Those are stored as their inspected string representation, so
 * a script can log anything.
 */
function toCloneable(value: unknown): unknown {
  try {
    structuredClone(value);
    return value;
  } catch {
    return inspect(value);
  }
}
