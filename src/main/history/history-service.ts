import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { inspect } from 'node:util';
import { ResponseBodyService } from 'main/network/service/response-body-service';
import {
  HistoryEntry,
  HistoryEntrySummary,
  MAX_HISTORY_ENTRIES,
  ScriptLog,
  SentRequest,
} from 'shim/history';
import { TrufosRequest } from 'shim/objects/request';
import { TrufosResponse } from 'shim/objects/response';
import { buildUrl } from 'shim/objects/url';

const responseBodyService = ResponseBodyService.instance;

/** Event signatures emitted by the {@link HistoryService}. */
type HistoryServiceEvents = {
  changed: [];
};

/**
 * Keeps the request history of the current session: every sent request with its response or
 * error and the output of its scripts. Bodies are stored as temporary files in the
 * {@link ResponseBodyService}, so entries only hold references to them.
 *
 * Everything that happens while a request is sent is attributed to its entry through an
 * {@link AsyncLocalStorage} context, see {@link record}. Entries contain secrets on purpose and
 * must never be written to the app log. The history is not persisted.
 */
export class HistoryService extends EventEmitter<HistoryServiceEvents> {
  public static readonly instance = new HistoryService();

  private readonly context = new AsyncLocalStorage<HistoryEntry>();

  /** All entries, oldest first. */
  private readonly entries: HistoryEntry[] = [];

  /** requestId => ID of the body of the latest response, which is still shown in the UI. */
  private readonly latestResponseBodies = new Map<string, string>();

  /**
   * Sends a request and records it in the history.
   * @param request the request that is sent
   * @param send sends the request and resolves with its response, or `null` if it was aborted
   * @returns the result of `send`
   */
  async record<T extends TrufosResponse | null>(
    request: TrufosRequest,
    send: () => Promise<T>
  ): Promise<T> {
    const entry: HistoryEntry = {
      id: randomUUID(),
      requestId: request.id,
      requestTitle: request.title,
      timestamp: Date.now(),
      method: request.method,
      url: buildUrl(request.url),
      scriptLogs: [],
    };

    try {
      const response = await this.context.run(entry, send);
      if (response == null) {
        entry.error = 'The request was aborted.';
      } else {
        this.setResponse(entry, response);
      }
      return response;
    } catch (error) {
      entry.error = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      this.add(entry);
    }
  }

  /**
   * Records the request of the current entry exactly as it is sent.
   * @param request the sent request
   * @returns the entry the request was recorded in, or `undefined` outside of {@link record}
   */
  recordSentRequest(request: SentRequest): HistoryEntry | undefined {
    const entry = this.context.getStore();
    if (entry == null) return;
    entry.request = request;
    entry.url = request.url;
    return entry;
  }

  /**
   * Records a console call or error of a user script in the current entry.
   * @param log the script output
   */
  recordScriptLog(log: ScriptLog): void {
    this.context.getStore()?.scriptLogs.push({ ...log, args: log.args.map(toCloneable) });
  }

  /** Lists all entries, newest first. */
  list(): HistoryEntrySummary[] {
    return this.entries
      .map(({ id, requestId, requestTitle, timestamp, method, url, status, duration, error }) => ({
        id,
        requestId,
        requestTitle,
        timestamp,
        method,
        url,
        status,
        duration,
        error,
      }))
      .reverse();
  }

  /**
   * Returns the entry with the given ID.
   * @param id the ID of the entry
   */
  get(id: string): HistoryEntry | undefined {
    return this.entries.find((entry) => entry.id === id);
  }

  /** Removes all entries and deletes their bodies, except the latest response of each request. */
  clear(): void {
    for (const entry of this.entries.splice(0)) {
      this.deleteBodies(entry);
    }
    this.emit('changed');
  }

  private setResponse(entry: HistoryEntry, response: TrufosResponse) {
    const { headers, metaInfo, id } = response;
    entry.status = metaInfo.status;
    entry.duration = metaInfo.duration;
    entry.response = {
      headers,
      metaInfo,
      body: id != null ? { id, size: metaInfo.size.bodySizeInBytes } : undefined,
    };

    // the previous response of this request is no longer shown in the UI
    const previous = this.latestResponseBodies.get(entry.requestId);
    if (id != null) {
      this.latestResponseBodies.set(entry.requestId, id);
    } else {
      this.latestResponseBodies.delete(entry.requestId);
    }
    if (previous != null && !this.entries.some((other) => other.response?.body?.id === previous)) {
      responseBodyService.remove(previous);
    }
  }

  private add(entry: HistoryEntry) {
    this.entries.push(entry);
    while (this.entries.length > MAX_HISTORY_ENTRIES) {
      this.deleteBodies(this.entries.shift()!);
    }
    this.emit('changed');
  }

  private deleteBodies(entry: HistoryEntry) {
    const requestBody = entry.request?.body?.id;
    if (requestBody != null) responseBodyService.remove(requestBody);

    const responseBody = entry.response?.body?.id;
    if (responseBody != null && this.latestResponseBodies.get(entry.requestId) !== responseBody) {
      responseBodyService.remove(responseBody);
    }
  }
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
