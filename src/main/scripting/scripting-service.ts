import { app } from 'electron';
import { castDraft, type Draft, produce } from 'immer';
import { CollectionStateService } from 'main/collection-state/collection-state-service';
import { createContext, Script } from 'node:vm';
import { ScriptConsole, ScriptingContext, ScriptType, VariableObject } from 'shim';
import { getDurationStringFromNow, getSteadyTimestamp } from 'main/util/time-util';
import type { ScriptLogger } from 'main/network/service/request-recorder';
import { ScriptLog } from 'shim/history';
import { CollectionChanges, CollectionInfo, CommandType } from 'shim/collection-model';
import { TrufosId } from 'shim/objects/id';

const collectionState = CollectionStateService.instance;

const SCRIPT_TIMEOUT_SECONDS = 5;

/**
 * Service for executing user-provided scripts in an isolated VM context.
 * Scripts run in a Node.js vm context with access to the scripting API.
 */
export class ScriptingService {
  public static readonly instance = new ScriptingService();

  /**
   * Creates the scripting API.
   * @param getCollection returns the draft of the collection the script reads and sets its
   * variables in
   * @param selectedEnvironmentKey the environment the script uses by default
   */
  private createApi(
    script: ScriptType,
    log: ScriptLogger,
    getCollection: () => Draft<CollectionInfo>,
    selectedEnvironmentKey?: string
  ) {
    const getEnvironment = (key = selectedEnvironmentKey) =>
      key == null ? undefined : getCollection().environments[key];

    return Object.freeze<ScriptingContext>({
      console: ScriptingService.createConsole(script, log),

      trufos: Object.freeze({
        version: app.getVersion(),

        getCollectionVariable: (name: string) => getCollection().variables[name]?.value,

        setCollectionVariable: (name: string, value: string | VariableObject) => {
          const { variables } = getCollection();
          variables[name] = ScriptingService.mergeVariable(variables[name], value);
        },

        getEnvironmentVariable: (name: string, environment?: string) =>
          getEnvironment(environment)?.variables[name]?.value,

        setEnvironmentVariable: (
          name: string,
          value: string | VariableObject,
          environment?: string
        ) => {
          // like reading, writing to an environment that does not exist has no effect
          const variables = getEnvironment(environment)?.variables;
          if (variables != null) {
            variables[name] = ScriptingService.mergeVariable(variables[name], value);
          }
        },
      }),
    });
  }

  /**
   * Creates the console of a script. Its output only goes to the given logger, e.g. the request
   * history, never to the app log, because scripts commonly log secrets like tokens.
   */
  private static createConsole(script: ScriptType, log: ScriptLogger): ScriptConsole {
    const forLevel =
      (level: ScriptLog['level']) =>
      (...args: unknown[]) =>
        log({ script, level, args });
    return Object.freeze({
      log: forLevel('info'),
      info: forLevel('info'),
      debug: forLevel('debug'),
      warn: forLevel('warn'),
      error: forLevel('error'),
    });
  }

  /** Merges a value set by a script into the variable it replaces. */
  private static mergeVariable(
    variable: VariableObject | undefined,
    value: string | VariableObject
  ): VariableObject {
    if (typeof value === 'string') value = { value };
    VariableObject.parse(value); // validate type and required properties
    return { ...variable, ...value };
  }

  /**
   * Executes a user script. Variables the script changes are applied to the open collection
   * afterwards. Writing them to disk is not waited for.
   * @param code the source code of the script
   * @param type the type of the script, used to label its console output
   * @param log receives the console output and errors of the script
   * @param collectionId the collection the script belongs to. If another collection is open, the
   * script is not run, as it would read and change the variables of that collection.
   */
  public async executeScript(
    code: string,
    type: ScriptType,
    log: ScriptLogger,
    collectionId: TrufosId
  ): Promise<void> {
    if (collectionState.model.collection.id !== collectionId) {
      const message =
        'The script was not run, as another collection was opened while the request was sent';
      logger.warn(message);
      log({ script: type, level: 'warn', args: [message] });
      return;
    }

    let script: Script;
    try {
      const now = getSteadyTimestamp();
      script = new Script(code);
      logger.debug(`Script compiled successfully after ${getDurationStringFromNow(now)}`);
    } catch (err) {
      logger.info(`Script compilation failed with ${errorName(err)}`);
      log({ script: type, level: 'error', args: [err] });
      return;
    }

    // The script runs synchronously, so the collection cannot change while it runs. The draft only
    // exists while it runs: a callback that runs later, e.g. from a promise, gets a throwaway copy
    // instead, so its reads see what the script left behind and its writes are lost.
    const { collection, selectedEnvironmentKey } = collectionState.model;
    let draft: Draft<CollectionInfo> | undefined;
    let finished: CollectionInfo = collection;
    const getCollection = () => {
      if (draft != null) return draft;
      log({
        script: type,
        level: 'error',
        args: [
          'The variables cannot be changed anymore, as the script has finished. Callbacks that run after the script, e.g. from a promise, are not supported.',
        ],
      });
      return castDraft(structuredClone(finished));
    };
    const changed = produce(collection, (recipe) => {
      draft = recipe;
      try {
        const context = createContext(
          this.createApi(type, log, getCollection, selectedEnvironmentKey),
          {
            name: 'Trufos Scripting Context',
          }
        );
        const now = getSteadyTimestamp();
        script.runInContext(context, { timeout: SCRIPT_TIMEOUT_SECONDS * 1000 });
        logger.debug(`Script executed successfully after ${getDurationStringFromNow(now)}`);
      } catch (err) {
        logger.info(`Script execution failed with ${errorName(err)}`);
        log({ script: type, level: 'error', args: [err] });
      } finally {
        draft = undefined;
      }
    });
    finished = changed;
    if (changed === collection) return;

    const changes: CollectionChanges = {};
    if (changed.variables !== collection.variables) changes.variables = changed.variables;
    if (changed.environments !== collection.environments) {
      changes.environments = changed.environments;
    }
    collectionState
      .apply({ type: CommandType.UPDATE_COLLECTION, changes })
      .catch((err) => logger.error('Failed to apply the variables changed by a script:', err));
  }
}

/**
 * The app log only gets the error type: the message may contain values used by the script. Errors
 * thrown by the script come from the VM's realm, so `instanceof Error` does not work for them.
 */
function errorName(error: unknown) {
  if (typeof error === 'object' && error != null && 'name' in error) return String(error.name);
  return typeof error;
}
