import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { inspect } from 'node:util';
import { BodyStore } from 'main/network/service/body-store';
import type { BodyCopy } from 'main/network/service/request-body-copy';
import type { RequestRecorder } from 'main/network/service/request-recorder';
import {
  HistoryEntry,
  HistoryEntrySummary,
  HistoryOutcome,
  MAX_HISTORY_ENTRIES,
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
  collectionDirPath: string;
  timestamp: number;
  sent?: { request: Omit<SentRequest, 'body'>; body?: BodyCopy };
  scriptLogs: ScriptLog[];
}

/** An entry together with the collection whose request it records. */
interface StoredEntry {
  collectionDirPath: string;
  entry: HistoryEntry;
}

/**
 * Keeps the request history of the current session: every sent request with its response or
 * error and the output of its scripts. Bodies are kept in the {@link BodyStore}, which the history
 * retains for as long as an entry references them.
 *
 * Each collection has a history of its own, identified by the collection's directory. The limit of
 * {@link MAX_HISTORY_ENTRIES} applies to all collections together, as it bounds the memory and the
 * body files of the session.
 *
 * Entries contain secrets on purpose and must never be written to the app log. The history is not
 * persisted.
 */
export class HistoryService extends EventEmitter<HistoryServiceEvents> {
  public static readonly instance = new HistoryService();

  /** All entries of all collections, oldest first. */
  private readonly entries: StoredEntry[] = [];

  /**
   * Sends a request and records it in the history.
   * @param request the request that is sent
   * @param collectionDirPath the directory of the collection the request belongs to. It is taken
   * when the request starts, so a request still running while the collection is changed is
   * recorded in the history of its own collection.
   * @param send sends the request and resolves with its response, or `null` if it was aborted. It
   * reports what happens while the request is sent to the given recorder.
   * @returns the result of `send`
   */
  async record(
    request: TrufosRequest,
    collectionDirPath: string,
    send: (recorder: RequestRecorder) => Promise<TrufosResponse | null>
  ): Promise<TrufosResponse | null> {
    const inFlight: InFlight = {
      request,
      collectionDirPath,
      timestamp: Date.now(),
      scriptLogs: [],
    };
    const recorder: RequestRecorder = {
      sent(sentRequest, body) {
        inFlight.sent = { request: sentRequest, body };
      },
      scriptLog(log) {
        inFlight.scriptLogs.push({ ...log, args: log.args.map(toCloneable) });
      },
    };

    let response: TrufosResponse | null;
    try {
      response = await send(recorder);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.store(inFlight, { type: 'error', message });
      throw error;
    }

    const outcome: HistoryOutcome =
      response == null ? { type: 'aborted' } : { type: 'response', response };
    await this.store(inFlight, outcome);
    return response;
  }

  /**
   * Lists the entries of a collection, newest first.
   * @param collectionDirPath the directory of the collection
   */
  list(collectionDirPath: string): HistoryEntrySummary[] {
    return this.entries
      .filter((stored) => stored.collectionDirPath === collectionDirPath)
      .map((stored) => summarizeHistoryEntry(stored.entry))
      .reverse();
  }

  /**
   * Returns the entry with the given ID.
   * @param id the ID of the entry
   * @param collectionDirPath OPTIONAL: the directory of the collection the entry must belong to
   */
  get(id: string, collectionDirPath?: string): HistoryEntry | undefined {
    return this.entries.find(
      (stored) =>
        stored.entry.id === id &&
        (collectionDirPath == null || stored.collectionDirPath === collectionDirPath)
    )?.entry;
  }

  /**
   * @param bodyId the ID of a body
   * @returns whether an entry holds the body as the body of its response
   */
  hasResponseBody(bodyId: string): boolean {
    return this.entries.some(
      ({ entry: { outcome } }) =>
        outcome.type === 'response' && outcome.response.body?.id === bodyId
    );
  }

  /**
   * Removes the entries of a collection and releases their bodies.
   * @param collectionDirPath the directory of the collection
   */
  clear(collectionDirPath: string): void {
    for (let i = this.entries.length - 1; i >= 0; i--) {
      if (this.entries[i].collectionDirPath !== collectionDirPath) continue;
      const [{ entry }] = this.entries.splice(i, 1);
      forEachBody(entry, (id) => bodyStore.release(id));
    }
    this.emit('changed');
  }

  /** Stores the entry of a finished request once the copy of its body is complete. */
  private async store(
    { request, collectionDirPath, timestamp, sent, scriptLogs }: InFlight,
    outcome: HistoryOutcome
  ) {
    // the request is finished, so whatever of the body was not sent yet will never be sent
    const body = sent?.body;
    body?.cancel();
    await body?.done;

    this.add(collectionDirPath, {
      id: randomUUID(),
      requestId: request.id,
      requestTitle: request.title,
      timestamp,
      method: request.method,
      url: sent?.request.url ?? buildUrl(request.url),
      request: sent && {
        ...sent.request,
        body: body && { id: body.id, size: bodyStore.getSize(body.id) ?? 0 },
      },
      outcome,
      scriptLogs,
    });
  }

  private add(collectionDirPath: string, entry: HistoryEntry) {
    forEachBody(entry, (id) => bodyStore.retain(id));
    this.entries.push({ collectionDirPath, entry });
    while (this.entries.length > MAX_HISTORY_ENTRIES) {
      forEachBody(this.entries.shift()!.entry, (id) => bodyStore.release(id));
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
