import { Readable } from 'node:stream';
import { TemplateReplaceStream } from 'template-replace-stream';
import { Initializable } from 'main/shared/initializable';
import { PersistenceService } from 'main/persistence/service/persistence-service';
import { Collection } from 'shim/objects/collection';
import { VariableObject } from 'shim/variables';
import { getSystemVariable, getSystemVariables } from './system-variable';

const persistenceService = PersistenceService.instance;

/**
 * The environment service is responsible for managing the current collection and
 * the system, collection, and request variables (the ones that can be used in the
 * request body, headers, etc.).
 */
export class EnvironmentService implements Initializable {
  public static readonly instance: EnvironmentService = new EnvironmentService();

  public currentCollection: Collection;

  /**
   * Initializes the environment service by loading the last used collection.
   */
  public async init() {
    // TODO: load the last used collection from state instead
    this.currentCollection = await persistenceService.loadDefaultCollection();
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
   * Sets a variable in the current collection.
   *
   * @param key The key of the variable.
   * @param value The new value of the variable.
   */
  public setCollectionVariable(key: string, value: string) {
    const variable = this.currentCollection.variables[key];
    if (variable !== undefined) {
      variable.value = value;
    } else {
      this.currentCollection.variables[key] = { key, value };
    }
  }

  /**
   * Sets and saves all variables in the current collection.
   * @param variables
   */
  public setAndSaveAllVariables(variables: VariableObject[]) {
    this.currentCollection.variables = {};
    variables.forEach((variable) => (this.currentCollection.variables[variable.key] = variable));
  }
  /**
   * Changes the current collection to the one at the specified path.
   *
   * @param path The path of the collection to load and set as the current collection.
   */
  public async changeCollection(path: string) {
    return (this.currentCollection = await persistenceService.loadCollection(path));
  }

  /**
   * Returns all active variables in the current collection. This also includes system
   * variables.
   */
  public getVariables() {
    return Object.values(this.currentCollection.variables).concat(getSystemVariables());
  }

  /**
   * Returns the value of a variable. The hierarchy is as follows:
   * 1. Collection variables
   * 2. System variables
   *
   * @param key The key of the variable.
   * @returns The value of the variable if it exists, otherwise undefined.
   */
  public getVariable(key: string): VariableObject | undefined {
    return this.currentCollection.variables[key] ?? getSystemVariable(key);
  }

  private getVariableValue(key: string) {
    return this.getVariable(key)?.value;
  }
}
