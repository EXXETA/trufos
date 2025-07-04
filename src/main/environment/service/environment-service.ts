import { Readable } from 'node:stream';
import { TemplateReplaceStream } from 'template-replace-stream';
import { Initializable } from 'main/shared/initializable';
import { PersistenceService } from 'main/persistence/service/persistence-service';
import { Collection, CollectionBase } from 'shim/objects/collection';
import { VariableMap } from 'shim/objects/variables';
import { getSystemVariable, getSystemVariables } from './system-variable';
import { SettingsService } from 'main/persistence/service/settings-service';
import { isCollection, TrufosObject } from 'shim/objects';
import { TrufosRequest } from 'shim/objects/request';
import { AuthorizationInformation, AuthorizationType } from 'shim/objects/auth';
import { createAuthStrategy } from 'main/network/authentication/auth-strategy-factory';

const persistenceService = PersistenceService.instance;
const settingsService = SettingsService.instance;

/**
 * The environment service is responsible for managing the current collection and
 * the system, collection, and request variables (the ones that can be used in the
 * request body, headers, etc.).
 */
export class EnvironmentService implements Initializable {
  public static readonly instance: EnvironmentService = new EnvironmentService();

  /** The current collection that is being used. */
  public get currentCollection() {
    return this._currentCollection;
  }

  /** The key of the current environment in the current collection. */
  public currentEnvironmentKey?: string;

  /** The currently selected environment in the current collection. */
  public get currentEnvironment() {
    if (this.currentEnvironmentKey == null) return;
    return this.currentCollection.environments[this.currentEnvironmentKey];
  }

  private _currentCollection: Collection;

  /**
   * Initializes the environment service by loading the last used collection. If that fails, the
   * default collection is loaded instead.
   */
  public async init() {
    const { settings } = settingsService;
    await persistenceService.createDefaultCollectionIfNotExists();

    const collectionDir = settings.collections[settings.currentCollectionIndex];
    try {
      await this.changeCollection(collectionDir);
    } catch (e) {
      logger.error(`Failed to load collection at ${collectionDir}:`, e);
      logger.info('Loading default collection instead.');
      await this.changeCollection(SettingsService.DEFAULT_COLLECTION_DIR);
    }
  }

  /**
   * Replaces any `{{ $someVariable }}` template variables in the given stream with their values.
   *
   * @param stream The stream to replace the variables in.
   * @returns The stream with the variables replaced.
   */
  public setVariablesInStream(stream: Readable) {
    return stream.pipe(new TemplateReplaceStream(this.getVariableValue.bind(this)));
  }

  /**
   * Replace all variables in the current collection with the given variables.
   * @param variables The variables of the Collection to set.
   */
  public setCollectionVariables(variables: VariableMap) {
    this.currentCollection.variables = variables;
  }

  /**
   * Loads the given collection and sets it as the current collection.
   *
   * @param collection The collection to select or the path to the collection.
   */
  public async changeCollection(collection: Collection | string) {
    // load collection
    this._currentCollection =
      typeof collection === 'string'
        ? await persistenceService.loadCollection(collection)
        : collection;

    // add collection to the list of open collections if it is not already there
    const path = this.currentCollection.dirPath;
    const settings = settingsService.modifiableSettings;
    const collectionIndex = settings.collections.indexOf(path);
    if (collectionIndex === -1) {
      settings.currentCollectionIndex = settings.collections.push(path) - 1;
    } else {
      settings.currentCollectionIndex = collectionIndex;
    }

    // save settings and return the current collection
    await settingsService.setSettings(settings);
    return this.currentCollection;
  }

  /**
   * Closes the collection at the specified path.
   * @param path The path of the collection to close. If not specified, the current collection is closed.
   */
  public async closeCollection(path?: string) {
    path ??= this.currentCollection.dirPath;
    logger.info('Closing collection at', path);

    // do not close the default collection
    const settings = settingsService.modifiableSettings;
    if (path === SettingsService.DEFAULT_COLLECTION_DIR || settings.collections.length <= 1) {
      logger.warn('Cannot close the default collection.');
      return this.currentCollection;
    }

    // change the current collection if the collection to close is the current one
    if (path === this.currentCollection.dirPath) {
      await this.changeCollection(SettingsService.DEFAULT_COLLECTION_DIR);
    }

    // remove the collection from the list of open collections
    settings.collections = settings.collections.filter((collectionPath) => collectionPath !== path);
    await settingsService.setSettings(settings);

    // return the current collection (after closing the specified collection)
    return this.currentCollection;
  }

  /**
   * Lists all collections that are currently open. This includes the default collection.
   * Closes any collections that fail to load.
   */
  public async listCollections() {
    const collections: CollectionBase[] = [];

    for (const dirPath of settingsService.settings.collections) {
      try {
        const collection = await persistenceService.loadCollection(dirPath, false);
        collections.push({
          id: collection.id,
          title: collection.title,
          dirPath,
        });
      } catch (e) {
        logger.error(`Failed to load collection at ${dirPath}:`, e);
        await this.closeCollection(dirPath).catch(logger.error);
      }
    }

    return collections;
  }

  /**
   * Returns all variables for the current state (e.g. collection variables). This also includes
   * system variables.
   */
  public getVariables() {
    return Object.entries(this.currentEnvironment?.variables ?? {})
      .concat(Object.entries(this.currentCollection.variables))
      .concat(getSystemVariables());
  }

  /**
   * Returns the value of a variable. The hierarchy is as follows:
   * 1. Environment variables
   * 2. Collection variables
   * 3. System variables
   *
   * @param key The key of the variable.
   * @returns The value of the variable if it exists, otherwise undefined.
   */
  public getVariable(key: string) {
    return (
      this.currentEnvironment?.variables[key] ??
      this.currentCollection.variables[key] ??
      getSystemVariable(key)
    );
  }

  private getVariableValue(key: string) {
    return this.getVariable(key)?.value;
  }

  /**
   * Returns the authorization header for the given object. If the object has an
   * authorization type of `INHERIT`, it will recursively get the authorization header from the
   * current collection.
   * @param auth The authorization information to get the header for.
   * @returns The authorization header as a string, or undefined if no authorization is set.
   */
  public async getAuthorizationHeader(
    auth?: AuthorizationInformation
  ): Promise<string | undefined> {
    if (auth == null) {
      return;
    } else if (auth.type === AuthorizationType.INHERIT) {
      return this.getAuthorizationHeader(this.currentCollection.auth);
    } else {
      return await createAuthStrategy(auth).getAuthHeader();
    }
  }
}
