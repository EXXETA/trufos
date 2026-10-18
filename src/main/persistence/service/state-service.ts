import path from 'node:path';
import { USER_DATA_DIR } from 'main/util/fs-util';
import { SemVer } from 'main/util/semver';
import { Initializable } from 'main/shared/initializable';
import { JsonFile } from 'main/persistence/json-file';
import { z } from 'zod';
import { CollectionUiState } from 'shim/collection-ui-state';
import { getValidEnvironmentKey } from 'shim/collection-model';
import { EnvironmentMap } from 'shim/objects/environment';

export const VERSION = new SemVer(1, 0, 0);

const DEFAULT_COLLECTION_DIR = path.join(USER_DATA_DIR, 'default-collection');

/** The state of an open collection. */
const OpenCollection = z.object({
  /** The directory of the collection. */
  dirPath: z.string(),

  /**
   * The key of the environment selected last, `null` if none was selected. Without one, the
   * collection starts with its first environment.
   */
  selectedEnvironmentKey: z.string().nullable().optional(),

  /** The UI state the renderer stored for the collection. */
  ui: CollectionUiState.optional(),
});
type OpenCollection = z.infer<typeof OpenCollection>;

const AppState = z
  .object({
    /** The open collections. */
    collections: z.array(OpenCollection).default(() => [{ dirPath: DEFAULT_COLLECTION_DIR }]),

    /** The directory of the current collection. */
    currentCollection: z.string().default(DEFAULT_COLLECTION_DIR),
  })
  .transform(({ collections, currentCollection }) => {
    // the default collection is always open
    if (!collections.some(({ dirPath }) => dirPath === DEFAULT_COLLECTION_DIR)) {
      collections = [{ dirPath: DEFAULT_COLLECTION_DIR }, ...collections];
    }
    // the current collection is one of the open collections
    if (!collections.some(({ dirPath }) => dirPath === currentCollection)) {
      currentCollection = DEFAULT_COLLECTION_DIR;
    }
    return { collections, currentCollection };
  });
type AppState = z.infer<typeof AppState>;

/**
 * Keeps the state of the application that main needs, e.g. which collections are open, in
 * `state.json`. Unlike the settings of the {@link SettingsService}, the user does not choose it
 * directly. The state of the open collection itself is kept by the `CollectionStateService`.
 */
export class StateService implements Initializable {
  public static readonly DEFAULT_COLLECTION_DIR = DEFAULT_COLLECTION_DIR;
  public static readonly STATE_FILE = path.join(USER_DATA_DIR, 'state.json');

  public static readonly instance = new StateService();

  private readonly file = new JsonFile<AppState>({
    filePath: StateService.STATE_FILE,
    version: VERSION,
    schema: AppState,
  });

  public init(): Promise<void> {
    return this.file.init();
  }

  /** The directories of the open collections. The default collection is always one of them. */
  public get openCollections(): string[] {
    return this.file.value.collections.map(({ dirPath }) => dirPath);
  }

  /** The directory of the current collection, which is one of the open collections. */
  public get currentCollection(): string {
    return this.file.value.currentCollection;
  }

  /** Opens the collection in the given directory, if it is not open yet, and makes it current. */
  public open(dirPath: string): Promise<void> {
    return this.file.update((state) => {
      if (!state.collections.some((collection) => collection.dirPath === dirPath)) {
        state.collections.push({ dirPath });
      }
      state.currentCollection = dirPath;
    });
  }

  /**
   * Closes the collection in the given directory and forgets its state. If it is the current one,
   * the default collection becomes current. The default collection stays open.
   */
  public close(dirPath: string): Promise<void> {
    return this.file.update((state) => {
      state.collections = state.collections.filter((collection) => collection.dirPath !== dirPath);
    });
  }

  /**
   * Returns the environment to select when the collection in the given directory is loaded: the
   * stored one if it still exists, none if none was selected, and the first one otherwise.
   * @param environments the environments of the collection
   */
  public selectedEnvironment(dirPath: string, environments: EnvironmentMap): string | undefined {
    const stored = this.find(dirPath)?.selectedEnvironmentKey;
    if (stored === null) return undefined;
    return getValidEnvironmentKey(environments, stored);
  }

  /**
   * Stores the selected environment of an open collection.
   * @param key the key of the environment, undefined if none is selected
   */
  public selectEnvironment(dirPath: string, key: string | undefined): Promise<void> {
    return this.updateOpenCollection(dirPath, (collection) => {
      collection.selectedEnvironmentKey = key ?? null;
    });
  }

  /** A copy of the UI state stored for the collection in the given directory. */
  public uiState(dirPath: string): CollectionUiState | undefined {
    const ui = this.find(dirPath)?.ui;
    return ui && CollectionUiState.parse(ui);
  }

  /** Stores the UI state of an open collection. */
  public saveUiState(dirPath: string, uiState: CollectionUiState): Promise<void> {
    return this.updateOpenCollection(dirPath, (collection) => {
      collection.ui = uiState;
    });
  }

  private find(dirPath: string) {
    return this.file.value.collections.find((collection) => collection.dirPath === dirPath);
  }

  /** Changes the state of an open collection. Nothing is stored for a collection that is not open. */
  private updateOpenCollection(
    dirPath: string,
    recipe: (collection: OpenCollection) => void
  ): Promise<void> {
    return this.file.update((state) => {
      const collection = state.collections.find((open) => open.dirPath === dirPath);
      if (collection == null) {
        logger.warn(`Not storing the state of collection ${dirPath}, as it is not open`);
        return;
      }
      recipe(collection);
    });
  }
}
