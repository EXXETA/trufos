import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { freeze } from 'immer';
import { Initializable } from 'main/shared/initializable';
import { PersistenceService } from 'main/persistence/service/persistence-service';
import { StateService } from 'main/persistence/service/state-service';
import { SerialQueue } from 'main/util/serial-queue';
import {
  applyCommandWithPatches,
  CollectionCommand,
  CollectionModel,
  CollectionSnapshot,
  CollectionStateEvent,
  CommandEnvelope,
  normalizeCollection,
} from 'shim/collection-model';
import { CollectionBase } from 'shim/objects/collection';
import { TrufosId } from 'shim/objects/id';
import { TrufosRequest } from 'shim/objects/request';
import { DisplayableError } from 'shim/error/DisplayableError';
import type { RequestFiles } from 'main/persistence/service/persistence-service';
import { getCommandEffects } from './command-effects';

const persistenceService = PersistenceService.instance;
const stateService = StateService.instance;

/** How long writing the info file of a request is postponed after its last edit. */
export const REQUEST_INFO_DEBOUNCE_MS = 2000;

/** Event signatures emitted by the {@link CollectionStateService}. */
type CollectionStateServiceEvents = {
  /** The model changed. The renderer replicates the model from these events. */
  changed: [event: CollectionStateEvent];
  /** Another collection became the current one. Reloading the current one does not count. */
  'collection-changed': [];
};

/**
 * Plans a command from the current model. Runs synchronously on the queue, so the model cannot
 * change until the command is applied.
 * @returns the command, or undefined if there is nothing to apply
 */
export type CommandPlan = (model: CollectionModel) => CollectionCommand | undefined;

const noop = () => {};

/**
 * A request together with its files and the model, taken at the moment it is sent. Its scripts
 * are read, its text body is streamed from the file opened then. So editing, saving or discarding
 * the request while it is sent cannot change what is sent, as these replace files instead of
 * changing them. Whoever prepared the request closes its text body.
 */
export interface PreparedRequest extends RequestFiles {
  request: TrufosRequest;
  /**
   * The model the request was taken from. The request is sent with its variables and client
   * certificate, or with the model a pre-request script left behind, see
   * {@link CollectionStateService.applyTo}.
   */
  model: CollectionModel;
}

/** Thrown if a change was meant for a collection that is no longer the open one. */
export class CollectionChangedError extends DisplayableError {
  constructor() {
    super(
      'Another collection was opened meanwhile, so the change was not applied. Please try again.',
      'Collection Changed'
    );
    Reflect.setPrototypeOf(this, CollectionChangedError.prototype);
    this.name = CollectionChangedError.name;
  }
}

/**
 * Owns the currently open collection as a {@link CollectionModel}. Every change is a
 * {@link CollectionCommand}: the service validates and applies it, broadcasts the resulting patches
 * with a `changed` event and persists the change.
 *
 * Everything that changes the model or touches the files of the collection runs on one queue, one
 * task after another: applying a command together with its persistence effect, delayed writes,
 * readers and loading another collection. So an effect is always written from the model it was
 * planned from, and a reader sees files that match the model. The info files of edited requests
 * are written with a delay, see {@link REQUEST_INFO_DEBOUNCE_MS}. If an effect fails, the
 * collection is reloaded from disk and broadcast as a snapshot.
 */
export class CollectionStateService
  extends EventEmitter<CollectionStateServiceEvents>
  implements Initializable
{
  public static readonly instance = new CollectionStateService();

  private _model?: CollectionModel;

  /** Runs everything that changes the model or touches the files of the collection. */
  private readonly queue = new SerialQueue();

  /**
   * The requests whose info file is outdated, with the timer that writes it. A request stays here
   * until its info file is written.
   */
  private readonly dirtyRequests = new Map<TrufosId, NodeJS.Timeout>();

  /** The current state of the open collection. It is immutable. */
  public get model(): CollectionModel {
    if (this._model == null) throw new Error('No collection is loaded');
    return this._model;
  }

  /** The complete state of the open collection, including the UI state stored for it. */
  public get snapshot(): CollectionSnapshot {
    const { model } = this;
    return { model, ui: stateService.uiState(model.collection.dirPath) };
  }

  /**
   * Loads the last used collection. If that fails, the default collection is loaded instead.
   */
  public async init(): Promise<void> {
    await persistenceService.createDefaultCollectionIfNotExists();

    const collectionDir = stateService.currentCollection;
    try {
      await this.load(collectionDir);
    } catch (e) {
      logger.error(`Failed to load collection at ${collectionDir}:`, e);
      logger.info('Loading default collection instead.');
      await this.load(StateService.DEFAULT_COLLECTION_DIR);
    }
  }

  /**
   * Loads the collection at the given directory, makes it the current one and broadcasts it as a
   * snapshot. Dirty requests of the previous collection are written first.
   * @param dirPath the directory of the collection
   */
  public load(dirPath: string): Promise<void> {
    return this.queue.run(() => this.loadModel(dirPath));
  }

  /**
   * Creates a new collection and makes it the current one.
   * @param dirPath the directory of the new collection. Must be empty or not exist.
   * @param title the title of the new collection
   */
  public async createCollection(dirPath: string, title: string): Promise<void> {
    const collection = await persistenceService.createCollection(dirPath, title);
    await this.load(collection.dirPath);
  }

  /**
   * Closes the collection at the given directory. If it is the current one, the default
   * collection is loaded instead. The default collection cannot be closed.
   * @param dirPath the directory of the collection to close. Defaults to the current one.
   */
  public closeCollection(dirPath?: string): Promise<void> {
    return this.queue.run(async () => {
      const closedDirPath = dirPath ?? this.model.collection.dirPath;
      logger.info('Closing collection at', closedDirPath);

      if (closedDirPath === StateService.DEFAULT_COLLECTION_DIR) {
        logger.warn('Cannot close the default collection.');
        return;
      }

      if (closedDirPath === this._model?.collection.dirPath) {
        await this.loadModel(StateService.DEFAULT_COLLECTION_DIR);
      }

      await stateService.close(closedDirPath);
    });
  }

  /**
   * Lists all collections that are currently open. This includes the default collection.
   * Closes any collections that fail to load.
   */
  public async listCollections(): Promise<CollectionBase[]> {
    const collections: CollectionBase[] = [];

    for (const dirPath of stateService.openCollections) {
      try {
        collections.push(await persistenceService.loadCollectionBase(dirPath));
      } catch (e) {
        logger.error(`Failed to load collection at ${dirPath}:`, e);
        await this.closeCollection(dirPath).catch(logger.error);
      }
    }

    return collections;
  }

  /**
   * Applies a command to the model, broadcasts the patches and persists the change. Immediate
   * effects are written before this resolves; request info files of edits are written later.
   * @param input the {@link CommandEnvelope}. It is validated, as it usually comes from the
   * renderer.
   * @returns the model version the command was applied as
   * @throws if the envelope is invalid, the command cannot be applied, persisting it failed, or
   * with a {@link CollectionChangedError} if another collection was opened before it was applied
   */
  public async dispatch(input: unknown): Promise<number> {
    const envelope = CommandEnvelope.parse(input);
    const applied = await this.runFor(this.model.collection.id, () => this.applyEnvelope(envelope));
    return applied.version;
  }

  /**
   * Plans a command from the current model and applies it, see {@link dispatch}. Both happen on
   * the queue, so the model the command was planned from is the one it is applied to.
   * @param collectionId the collection the plan belongs to
   * @param plan the {@link CommandPlan}
   * @returns the model after the command was applied. Rejects if the plan or applying its command
   * failed, or with a {@link CollectionChangedError} if another collection is open when it is the
   * plan's turn.
   */
  public applyTo(collectionId: TrufosId, plan: CommandPlan): Promise<CollectionModel> {
    return this.runFor(collectionId, async () => {
      const command = plan(this.model);
      if (command != null) await this.applyEnvelope(this.envelopeOf(command));
      return this.model;
    });
  }

  /**
   * Reads the model while no change is applied, after everything queued before.
   * @param reader reads the model as it is when the reader runs
   * @returns the result of the reader
   */
  public read<T>(reader: (model: CollectionModel) => T | Promise<T>): Promise<T> {
    return this.queue.run(async () => await reader(this.model));
  }

  /**
   * Reads files of a request while no change is written. Dirty requests are written first, so the
   * files match the request the reader gets.
   * @param id the ID of the request
   * @param reader reads the files. It gets the request as it is when the reader runs.
   * @returns the result of the reader, or undefined if there is no such request
   */
  public readRequest<T>(
    id: TrufosId,
    reader: (request: TrufosRequest) => Promise<T>
  ): Promise<T | undefined> {
    this.flush().catch(noop); // already logged, and the reader does not depend on it
    return this.read(async (model) => {
      const request = model.requests.get(id);
      return request == null ? undefined : await reader(request);
    });
  }

  /**
   * Opens a request for sending, see {@link PreparedRequest}.
   * @param id the ID of the request
   * @throws if there is no such request
   */
  public async prepareRequest(id: TrufosId): Promise<PreparedRequest> {
    const prepared = await this.readRequest(id, async (request) => ({
      request,
      model: this.model,
      ...(await persistenceService.openRequestFiles(request)),
    }));
    if (prepared == null) throw new Error(`Request ${id} does not exist`);
    return prepared;
  }

  /**
   * Runs a task on the queue if the given collection is still the open one when it is its turn.
   * @throws a {@link CollectionChangedError} if another collection is open
   */
  private runFor<T>(collectionId: TrufosId, task: () => Promise<T>): Promise<T> {
    return this.queue.run(() => {
      if (this._model?.collection.id !== collectionId) throw new CollectionChangedError();
      return task();
    });
  }

  private envelopeOf(command: CollectionCommand): CommandEnvelope {
    return { commandId: randomUUID(), timestamp: Date.now(), command };
  }

  /**
   * Applies a command, broadcasts its patches and runs its immediate effect. Runs on the queue.
   * @returns the model the command was applied to
   */
  private async applyEnvelope(envelope: CommandEnvelope): Promise<CollectionModel> {
    const prev = this.model;
    const [next, patches] = applyCommandWithPatches(prev, envelope);
    this._model = next;
    this.emit('changed', {
      kind: 'patches',
      version: next.version,
      patches,
      commandId: envelope.commandId,
    });

    if (next.selectedEnvironmentKey !== prev.selectedEnvironmentKey) {
      // the selection is app state, not part of the collection, so a failure is only logged
      await stateService
        .selectEnvironment(next.collection.dirPath, next.selectedEnvironmentKey)
        .catch((error) => logger.error('Failed to store the selected environment:', error));
    }

    const effects = getCommandEffects(prev, next, envelope.command);
    if (effects.dirtyRequestId != null) this.markDirty(effects.dirtyRequestId);
    for (const id of effects.cleanRequestIds ?? []) this.markClean(id);
    if (effects.immediate != null) await this.runEffect(effects.immediate);
    return next;
  }

  /** Postpones writing the info file of a request until it was not edited for a while. */
  private markDirty(id: TrufosId) {
    clearTimeout(this.dirtyRequests.get(id));
    // already logged, and nobody waits for a delayed write
    const timer = setTimeout(() => this.flush([id]).catch(noop), REQUEST_INFO_DEBOUNCE_MS);
    this.dirtyRequests.set(id, timer);
  }

  /** Drops the delayed write of a request whose info file is written otherwise. */
  private markClean(id: TrufosId) {
    clearTimeout(this.dirtyRequests.get(id));
    this.dirtyRequests.delete(id);
  }

  /**
   * Writes the info files of the given dirty requests, of all dirty ones by default, after
   * everything queued before is done. Like any effect, a failed write reloads the collection.
   * @throws if writing a dirty request failed
   */
  public flush(ids?: TrufosId[]): Promise<void> {
    return this.queue.run(() =>
      this.runEffect(() => this.writeDirtyRequests(ids ?? [...this.dirtyRequests.keys()]))
    );
  }

  /**
   * Writes the info files of those of the given requests that are still dirty, as they are now. A
   * request that was deleted meanwhile is skipped. Runs on the queue.
   */
  private async writeDirtyRequests(ids: TrufosId[]) {
    for (const id of ids) {
      if (!this.dirtyRequests.has(id)) continue;
      const request = this.model.requests.get(id);
      if (request != null) await persistenceService.saveRequestInfo(request);
      this.markClean(id);
    }
  }

  /**
   * Runs a persistence effect. If it fails, the collection is reloaded from disk before anything
   * else runs, so the model matches the disk again. Runs on the queue.
   */
  private async runEffect(effect: () => Promise<void>) {
    try {
      await effect();
    } catch (error) {
      logger.error('Failed to persist a change of the collection, reloading it:', error);
      const dirPath = this._model?.collection.dirPath;
      if (dirPath != null) {
        await this.loadModel(dirPath).catch((reloadError) => {
          logger.error(`Failed to reload the collection at ${dirPath}:`, reloadError);
        });
      }
      throw error;
    }
  }

  /**
   * Loads the collection, makes it the current one and broadcasts it as a snapshot. The info files
   * of dirty requests are written first, so their edits survive if possible. Runs on the queue.
   */
  private async loadModel(dirPath: string) {
    for (const id of [...this.dirtyRequests.keys()]) {
      await this.writeDirtyRequests([id]).catch((error) => {
        logger.error(`Failed to write request ${id} before loading a collection:`, error);
      });
    }

    const previous = this._model;
    const collection = await persistenceService.loadCollection(dirPath);

    const model = normalizeCollection(collection);
    // the app state has the environment selected last, also when the collection is reloaded
    model.selectedEnvironmentKey = stateService.selectedEnvironment(
      collection.dirPath,
      collection.environments
    );
    const drafts = [...model.requests.values()].filter((request) => request.draft);
    const savedRequests = await Promise.all(
      drafts.map((draft) => persistenceService.loadSavedRequest(draft.id, draft.parentId))
    );
    for (const saved of savedRequests) {
      if (saved != null) model.savedRequests.set(saved.id, saved);
    }
    // the version never goes back, so the renderer can tell old events from new ones
    if (previous != null) model.version = previous.version + 1;

    // the collection only becomes the current one once nothing can fail anymore, so main and the
    // renderer never disagree about which collection is open
    await this.addToOpenCollections(collection.dirPath);
    this._model = freeze(model, true);
    // the edits of the previous model were written before, or could not be written at all
    for (const id of [...this.dirtyRequests.keys()]) this.markClean(id);
    this.emit('changed', { kind: 'snapshot', ...this.snapshot });
    if (collection.dirPath !== previous?.collection.dirPath) this.emit('collection-changed');
  }

  /** Adds the collection to the open collections and makes it the current one. */
  private async addToOpenCollections(dirPath: string) {
    await stateService.open(dirPath);
  }
}
