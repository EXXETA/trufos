import { Readable } from 'node:stream';
import { normalize } from 'node:path';
import { TemplateReplaceStream } from 'template-replace-stream';
import { Initializable } from 'main/shared/initializable';
import { PersistenceService } from 'main/persistence/service/persistence-service';
import { Collection } from 'shim/objects/collection';
import { VariableMap } from 'shim/objects/variables';
import { getSystemVariable, getSystemVariables } from './system-variable';
import { SettingsService } from 'main/persistence/service/settings-service';

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
  public currentCollection: Collection;

  /** The key of the current environment in the current collection. */
  public currentEnvironmentKey?: string;

  /** The currently selected environment in the current collection. */
  public get currentEnvironment() {
    if (this.currentEnvironmentKey == null) return;
    return this.currentCollection.environments[this.currentEnvironmentKey];
  }

  /**
   * Initializes the environment service by loading the last used collection.
   */
  public async init() {
    const { settings } = settingsService;
    await persistenceService.createDefaultCollectionIfNotExists();

    const collectionDir = settings.collections[settings.currentCollectionIndex];
    this.currentCollection = await persistenceService.loadCollection(collectionDir);
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
    this.currentCollection =
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
    path = normalize(path);

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
}
