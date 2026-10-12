import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { freeze, produceWithPatches } from 'immer';
import { Initializable } from 'main/shared/initializable';
import { PersistenceService } from 'main/persistence/service/persistence-service';
import { SettingsService } from 'main/persistence/service/settings-service';
import {
  applyCommand,
  CollectionCommand,
  CollectionModel,
  CollectionStateEvent,
  CommandEnvelope,
  normalizeCollection,
} from 'shim/collection-model';
import { Collection, CollectionBase } from 'shim/objects/collection';
import { Folder } from 'shim/objects/folder';
import { TrufosRequest } from 'shim/objects/request';
import { persistCommand } from './collection-persister';

const persistenceService = PersistenceService.instance;
const settingsService = SettingsService.instance;

/** How long the info file of an edited request is not written after its last edit. */
export const REQUEST_INFO_DEBOUNCE_MS = 300;

/** Event signatures emitted by the {@link CollectionStateService}. */
type CollectionStateServiceEvents = {
  /** The model changed. The renderer replicates the model from these events. */
  changed: [event: CollectionStateEvent];
  /** Another collection became the current one. Reloading the current one does not count. */
  'collection-changed': [];
};

/**
 * Owns the currently open collection as a {@link CollectionModel}. Every change is a
 * {@link CollectionCommand}: the service validates and applies it, broadcasts the resulting patches
 * with a `changed` event and persists the change.
 *
 * Persistence effects run one after another on a serial queue. Edits of a request are written
 * debounced, everything else immediately. If an effect fails, the collection is reloaded from disk
 * and broadcast as a snapshot.
 */
export class CollectionStateService
  extends EventEmitter<CollectionStateServiceEvents>
  implements Initializable
{
  public static readonly instance = new CollectionStateService();

  private _model?: CollectionModel;

  /** The tail of the serial persistence queue. It never rejects. */
  private queue: Promise<void> = Promise.resolve();

  /** The pending debounced info file writes, by request ID. */
  private readonly debounced = new Map<string, NodeJS.Timeout>();

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
   * snapshot. Pending writes of the previous collection are flushed first.
   * @param dirPath the directory of the collection
   */
  public async load(dirPath: string): Promise<void> {
    await this.flush();
    await this.loadModel(dirPath);
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
  public async closeCollection(dirPath?: string): Promise<void> {
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
      await this.load(SettingsService.DEFAULT_COLLECTION_DIR);
    }

    // remove the collection from the list of open collections
    const settings = settingsService.modifiableSettings;
    const current = settings.collections[settings.currentCollectionIndex];
    settings.collections = settings.collections.filter((path) => path !== dirPath);
    settings.currentCollectionIndex = Math.max(0, settings.collections.indexOf(current));
    await settingsService.setSettings(settings);
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
   * Applies a command to the model, broadcasts the patches and persists the change. Structural
   * changes are written before this resolves; request edits are written debounced.
   * @param input the {@link CommandEnvelope}. It is validated, as it usually comes from the
   * renderer.
   * @throws if the envelope is invalid, the command cannot be applied or persisting it failed
   */
  public async dispatch(input: unknown): Promise<void> {
    const envelope = CommandEnvelope.parse(input);
    const prev = this.model;
    const [next, patches] = produceWithPatches(prev, (draft) => {
      applyCommand(draft, envelope);
      draft.version++;
    });
    this._model = next;
    this.emit('changed', {
      kind: 'patches',
      version: next.version,
      patches,
      commandId: envelope.commandId,
    });

    const { command } = envelope;
    const plan = persistCommand(prev, next, command);
    if (command.type === 'saveRequest' || command.type === 'discardRequest') {
      // saving writes the latest draft itself and discarding makes the pending write obsolete
      this.cancelDebounce(command.id);
    }
    for (const requestId of plan.debounce ?? []) this.debounce(requestId);
    if (plan.immediate != null) await this.enqueue(plan.immediate);
  }

  /**
   * Builds an envelope for a command issued by the main process itself and dispatches it.
   * @param command the command to apply
   */
  public async apply(command: CollectionCommand): Promise<void> {
    await this.dispatch({ commandId: randomUUID(), timestamp: Date.now(), command });
  }

  /**
   * Runs all pending debounced writes now and waits until every queued write is done.
   */
  public async flush(): Promise<void> {
    for (const requestId of [...this.debounced.keys()]) {
      this.cancelDebounce(requestId);
      this.enqueueRequestInfo(requestId);
    }
    await this.queue;
  }

  private debounce(requestId: string) {
    this.cancelDebounce(requestId);
    const timeout = setTimeout(() => {
      this.debounced.delete(requestId);
      this.enqueueRequestInfo(requestId);
    }, REQUEST_INFO_DEBOUNCE_MS);
    this.debounced.set(requestId, timeout);
  }

  private cancelDebounce(requestId: string) {
    clearTimeout(this.debounced.get(requestId));
    this.debounced.delete(requestId);
  }

  /** Queues writing the info file of a request in the state it has when the write runs. */
  private enqueueRequestInfo(requestId: string) {
    this.enqueue(async () => {
      // the request may have been deleted in the meantime
      const request = this._model?.requests.get(requestId);
      if (request != null) await persistenceService.saveRequestInfo(request);
    }).catch(() => {}); // already logged, and nobody waits for a debounced write
  }

  /**
   * Adds an effect to the serial persistence queue. If it fails, the collection is reloaded from
   * disk before the next effect runs.
   * @returns a promise that settles with the effect
   */
  private enqueue(effect: () => Promise<void>): Promise<void> {
    const result = this.queue.then(async () => {
      try {
        await effect();
      } catch (error) {
        logger.error('Failed to persist a change of the collection, reloading it:', error);
        await this.reloadAfterFailure();
        throw error;
      }
    });
    this.queue = result.catch(() => {});
    return result;
  }

  private async reloadAfterFailure() {
    for (const requestId of [...this.debounced.keys()]) this.cancelDebounce(requestId);
    const dirPath = this._model?.collection.dirPath;
    if (dirPath == null) return;
    try {
      await this.loadModel(dirPath);
    } catch (error) {
      logger.error(`Failed to reload the collection at ${dirPath}:`, error);
    }
  }

  /** Loads the collection without waiting for the persistence queue. */
  private async loadModel(dirPath: string) {
    const previous = this._model;
    const collection = await persistenceService.loadCollection(dirPath);
    const savedRequests = await this.loadSavedRequests(collection);

    // keep the selected environment when the same collection is reloaded
    const selectedEnvironmentKey =
      previous?.collection.id === collection.id ? previous.selectedEnvironmentKey : undefined;
    const model = normalizeCollection(collection, savedRequests, selectedEnvironmentKey);
    // the version never goes back, so the renderer can tell old events from new ones
    if (previous != null) model.version = previous.version + 1;
    this._model = freeze(model, true);

    await this.addToOpenCollections(collection.dirPath);
    this.emit('changed', { kind: 'snapshot', model: this._model });
    if (collection.dirPath !== previous?.collection.dirPath) this.emit('collection-changed');
  }

  /** Loads the saved state of every request of the collection that has a draft. */
  private async loadSavedRequests(collection: Collection) {
    const savedRequests: TrufosRequest[] = [];
    const queue: (Folder | TrufosRequest)[] = [...collection.children];
    for (let node = queue.pop(); node != null; node = queue.pop()) {
      if (node.type === 'folder') {
        queue.push(...node.children);
      } else if (node.draft) {
        const saved = await persistenceService.loadSavedRequest(node.id, node.parentId);
        if (saved != null) savedRequests.push(saved);
      }
    }
    return savedRequests;
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
