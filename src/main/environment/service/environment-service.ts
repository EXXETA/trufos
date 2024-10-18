import { Readable } from 'node:stream';
import { randomInt, randomUUID } from 'node:crypto';
import { TemplateReplaceStream } from 'template-replace-stream';
import { Initializable } from 'main/shared/initializable';
import { PersistenceService } from 'main/persistence/service/persistence-service';
import { Collection } from 'shim/objects/collection';
import { VariableObject } from 'shim/variables';

const persistenceService = PersistenceService.instance;

/**
 * The environment service is responsible for managing the current collection and
 * the system, collection, and request variables (the ones that can be used in the
 * request body, headers, etc.).
 */
export class EnvironmentService implements Initializable {
  public static readonly instance: EnvironmentService =
    new EnvironmentService();

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
    return stream.pipe(
      new TemplateReplaceStream(this.getVariableValue.bind(this)),
    );
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
      this.currentCollection.variables[key] = { value, enabled: true };
    }
  }

  /**
   * Enables or disables a variable in the current collection.
   *
   * @param key The key of the variable.
   * @param enabled Whether the variable should be enabled or disabled.
   */
  public setCollectionVariableEnabled(key: string, enabled: boolean) {
    const variable = this.currentCollection.variables[key];
    if (variable !== undefined) variable.enabled = enabled;
  }

  /**
   * Replaces all variables in the current collection with the provided variables.
   *
   * @param variables The new variables to set.
   */
  public setCollectionVariables(variables: Record<string, VariableObject>) {
    this.currentCollection.variables = variables;
  }

  /**
   * Changes the current collection to the one at the specified path.
   *
   * @param path The path of the collection to load and set as the current collection.
   */
  public async changeCollection(path: string) {
    return (this.currentCollection = await persistenceService.loadCollection(
      path,
    ));
  }

  /**
   * Returns the value of a variable. The hierarchy is as follows:
   * 1. Collection variables
   * 2. System variables
   *
   * @param key The key of the variable.
   * @returns The value of the variable if it exists and  is enabled, otherwise undefined.
   */
  private getVariableValue(key: string) {
    return (
      this.currentCollection.variables[key]?.value ??
      this.getSystemVariableValue(key)
    );
  }

  /**
   * Returns the value of a dynamic, predefined system variable.
   *
   * @param key The key of the system variable.
   * @returns The value of the system variable.
   */
  private getSystemVariableValue(key: string) {
    switch (key) {
      case '$timestampIso':
        return new Date().toISOString();
      case '$timestampUnix':
        return Math.floor(Date.now() / 1e3).toString();
      case '$time':
        return new Date().toTimeString();
      case '$date':
        return new Date().toDateString();
      case '$randomInt':
        return randomInt(2 ** 48 - 1).toString();
      case '$randomUuid':
        return randomUUID();
    }
  }
}
