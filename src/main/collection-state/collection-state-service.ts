import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { freeze } from 'immer';
import { Initializable } from 'main/shared/initializable';
import { PersistenceService } from 'main/persistence/service/persistence-service';
import { SettingsService } from 'main/persistence/service/settings-service';
import {
  applyCommandWithPatches,
  CollectionCommand,
  CollectionModel,
  CollectionStateEvent,
  CommandEnvelope,
  normalizeCollection,
} from 'shim/collection-model';
import { CollectionBase } from 'shim/objects/collection';
import { TrufosId } from 'shim/objects/id';
import { TrufosRequest } from 'shim/objects/request';
import type { PreparedRequest } from 'main/network/service/http-service';
import { getCommandEffects } from './command-effects';

const persistenceService = PersistenceService.instance;
const settingsService = SettingsService.instance;

/** How long writing the info file of a request is postponed after its last edit. */
export const REQUEST_INFO_DEBOUNCE_MS = 2000;

/** Event signatures emitted by the {@link CollectionStateService}. */
type CollectionStateServiceEvents = {
  /** The model changed. The renderer replicates the model from these events. */
  changed: [event: CollectionStateEvent];
  /** Another collection became the current one. Reloading the current one does not count. */
  'collection-changed': [];
};

const noop = () => {};

/**
 * Owns the currently open collection as a {@link CollectionModel}. Every change is a
 * {@link CollectionCommand}: the service validates and applies it, broadcasts the resulting patches
 * with a `changed` event and persists the change.
 *
 * Persistence effects run one after another on a serial queue, together with everything else that
 * touches the files of the collection: readers and loading another collection. The info files of
 * edited requests are written with a delay, see {@link REQUEST_INFO_DEBOUNCE_MS}. If an effect
 * fails, the collection is reloaded from disk and broadcast as a snapshot.
 */
export class CollectionStateService
  extends EventEmitter<CollectionStateServiceEvents>
  implements Initializable
{
  public static readonly instance = new CollectionStateService();

  private _model?: CollectionModel;

  /** The tail of the serial queue. It never rejects. */
  private queue: Promise<void> = Promise.resolve();

  /**
   * The requests whose info file is outdated, with the timer that writes it. A request stays here
   * until its info file is written.
   */
  private readonly dirtyRequests = new Map<TrufosId, NodeJS.Timeout>();

  /**
   * Incremented whenever the model is replaced by loading it from disk. Effects queued for an
   * older generation were planned from a model that no longer exists and are skipped.
   */
  private generation = 0;

  /** How many loads or reloads are in progress. Commands are rejected while this is not 0. */
  private loading = 0;

  /** The current state of the open collection. It is immutable. */
  public get model(): CollectionModel {
    if (this._model == null) throw new Error('No collection is loaded');
    return this._model;
  }

  /**
   * Loads the last used collection. If that fails, the default collection is loaded instead.
   */
  public async init(): Promise<void> {
    const { settings } = settingsService;
    await persistenceService.createDefaultCollectionIfNotExists();

    const collectionDir = settings.collections[settings.currentCollectionIndex];
    try {
      await this.load(collectionDir);
    } catch (e) {
      logger.error(`Failed to load collection at ${collectionDir}:`, e);
      logger.info('Loading default collection instead.');
      await this.load(SettingsService.DEFAULT_COLLECTION_DIR);
    }
  }

  /**
   * Loads the collection at the given directory, makes it the current one and broadcasts it as a
   * snapshot. Dirty requests of the previous collection are written first.
   * @param dirPath the directory of the collection
   */
  public load(dirPath: string): Promise<void> {
    return this.exclusive(() => this.loadModel(dirPath));
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
    return this.exclusive(async () => {
      dirPath ??= this.model.collection.dirPath;
      logger.info('Closing collection at', dirPath);

      if (
        dirPath === SettingsService.DEFAULT_COLLECTION_DIR ||
        settingsService.settings.collections.length <= 1
      ) {
        logger.warn('Cannot close the default collection.');
        return;
      }

      if (dirPath === this._model?.collection.dirPath) {
        await this.loadModel(SettingsService.DEFAULT_COLLECTION_DIR);
      }

      // remove the collection from the list of open collections
      const settings = settingsService.modifiableSettings;
      const current = settings.collections[settings.currentCollectionIndex];
      settings.collections = settings.collections.filter((path) => path !== dirPath);
      settings.currentCollectionIndex = Math.max(0, settings.collections.indexOf(current));
      await settingsService.setSettings(settings);
    });
  }

  /**
   * Lists all collections that are currently open. This includes the default collection.
   * Closes any collections that fail to load.
   */
  public async listCollections(): Promise<CollectionBase[]> {
    const collections: CollectionBase[] = [];

    for (const dirPath of settingsService.settings.collections) {
      try {
        const collection = await persistenceService.loadCollection(dirPath, false);
        collections.push({ id: collection.id, title: collection.title, dirPath });
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
   * @throws if the envelope is invalid, the command cannot be applied, the collection is being
   * loaded, or persisting it failed or was skipped because the collection was reloaded meanwhile
   */
  public async dispatch(input: unknown): Promise<void> {
    await this.applyEnvelope(CommandEnvelope.parse(input));
  }

  /**
   * Applies a command issued by the main process itself, see {@link dispatch}. Unlike there, the
   * model is changed when this returns, so callers may choose not to wait for the persistence.
   * @param command the command to apply
   * @returns a promise that settles when the change is persisted. It rejects if the command cannot
   * be applied or the collection is being loaded.
   */
  public async apply(command: CollectionCommand): Promise<void> {
    return this.applyEnvelope({ commandId: randomUUID(), timestamp: Date.now(), command });
  }

  /** Applies a command synchronously and returns the promise of its persistence. */
  private applyEnvelope(envelope: CommandEnvelope): Promise<void> {
    if (this.loading > 0) {
      throw new Error('The collection is being loaded, the command was not applied');
    }
    const { model: prev, generation } = this;
    const [next, patches] = applyCommandWithPatches(prev, envelope);
    this._model = next;
    this.emit('changed', {
      kind: 'patches',
      version: next.version,
      patches,
      commandId: envelope.commandId,
    });

    const effects = getCommandEffects(prev, next, envelope.command);
    if (effects.dirtyRequestId != null) this.markDirty(effects.dirtyRequestId);
    for (const id of effects.cleanRequestIds ?? []) this.markClean(id);
    return effects.immediate == null
      ? Promise.resolve()
      : this.enqueue(effects.immediate, generation);
  }

  /**
   * Queues writing all dirty requests right away and waits until every queued write is done.
   */
  public flush(): Promise<void> {
    this.enqueueDirtyWrites();
    return this.queue;
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
    this.enqueueDirtyWrites();
    return this.chain(async () => {
      const request = this.model.requests.get(id);
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
      collectionId: this.model.collection.id,
      ...(await persistenceService.openRequestFiles(request)),
    }));
    if (prepared == null) throw new Error(`Request ${id} does not exist`);
    return prepared;
  }

  /**
   * Runs a task that loads a collection on the queue, after the dirty requests are written.
   * Commands are rejected from now on until the task has settled.
   */
  private exclusive<T>(task: () => Promise<T>): Promise<T> {
    this.enqueueDirtyWrites();
    this.loading++;
    return this.chain(task).finally(() => this.loading--);
  }

  /** Runs the task after everything queued before it. Returns the task's own promise. */
  private chain<T>(task: () => Promise<T>): Promise<T> {
    const result = this.queue.then(task);
    this.queue = result.then(noop, noop);
    return result;
  }

  /** Postpones writing the info file of a request until it was not edited for a while. */
  private markDirty(id: TrufosId) {
    clearTimeout(this.dirtyRequests.get(id));
    const timer = setTimeout(() => this.enqueueDirtyWrites([id]), REQUEST_INFO_DEBOUNCE_MS);
    this.dirtyRequests.set(id, timer);
  }

  /** Drops the delayed write of a request whose info file is written otherwise. */
  private markClean(id: TrufosId) {
    clearTimeout(this.dirtyRequests.get(id));
    this.dirtyRequests.delete(id);
  }

  /** Queues writing the info files of the given dirty requests, of all by default. */
  private enqueueDirtyWrites(ids = [...this.dirtyRequests.keys()]) {
    if (ids.length === 0) return;
    // already logged, and nobody waits for a delayed write
    this.enqueue(() => this.writeDirtyRequests(ids), this.generation).catch(noop);
  }

  /**
   * Writes the info files of the given requests as they are now, unless they are not dirty anymore
   * or were deleted meanwhile.
   */
  private async writeDirtyRequests(ids: TrufosId[]) {
    for (const id of ids) {
      const timer = this.dirtyRequests.get(id);
      if (timer == null) continue;
      const request = this.model.requests.get(id);
      if (request != null) await persistenceService.saveRequestInfo(request);
      if (this.dirtyRequests.get(id) === timer) this.markClean(id);
    }
  }

  /**
   * Adds an effect to the serial queue. If it fails, the collection is reloaded from disk before
   * the next effect runs.
   * @param effect the effect to run
   * @param generation the {@link generation} of the model the effect was planned from. If the
   * model was reloaded since, the effect is skipped and the returned promise rejects.
   * @returns a promise that settles with the effect
   */
  private enqueue(effect: () => Promise<void>, generation: number): Promise<void> {
    return this.chain(async () => {
      if (generation !== this.generation) {
        logger.warn('Skipping a change planned before the collection was reloaded');
        throw new Error('The collection was reloaded before the change could be written');
      }
      try {
        await effect();
      } catch (error) {
        logger.error('Failed to persist a change of the collection, reloading it:', error);
        await this.reloadAfterFailure();
        throw error;
      }
    });
  }

  /**
   * Reloads the collection from disk after an effect failed. The info files of dirty requests are
   * written first, so their edits survive the reload if possible.
   */
  private async reloadAfterFailure() {
    this.loading++;
    try {
      for (const id of [...this.dirtyRequests.keys()]) {
        await this.writeDirtyRequests([id]).catch((error) => {
          logger.error(`Failed to write request ${id} before reloading:`, error);
        });
      }

      const dirPath = this._model?.collection.dirPath;
      if (dirPath == null) return;
      await this.loadModel(dirPath).catch((error) => {
        logger.error(`Failed to reload the collection at ${dirPath}:`, error);
      });
    } finally {
      this.loading--;
    }
  }

  /** Loads the collection, makes it the current one and broadcasts it as a snapshot. */
  private async loadModel(dirPath: string) {
    const previous = this._model;
    const collection = await persistenceService.loadCollection(dirPath);

    // keep the selected environment when the same collection is reloaded
    const selectedEnvironmentKey =
      previous?.collection.id === collection.id ? previous.selectedEnvironmentKey : undefined;
    const model = normalizeCollection(collection, [], selectedEnvironmentKey);
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
    this.generation++;
    // the edits of the previous model were written before, or could not be written at all
    for (const id of [...this.dirtyRequests.keys()]) this.markClean(id);
    this.emit('changed', { kind: 'snapshot', model: this._model });
    if (collection.dirPath !== previous?.collection.dirPath) this.emit('collection-changed');
  }

  /** Adds the collection to the open collections in the settings and makes it the current one. */
  private async addToOpenCollections(dirPath: string) {
    const settings = settingsService.modifiableSettings;
    const collectionIndex = settings.collections.indexOf(dirPath);
    if (collectionIndex === -1) {
      settings.currentCollectionIndex = settings.collections.push(dirPath) - 1;
    } else {
      settings.currentCollectionIndex = collectionIndex;
    }
    await settingsService.setSettings(settings);
  }
}
