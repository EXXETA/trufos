import { app } from 'electron';
import { CollectionStateService } from 'main/collection-state/collection-state-service';
import { createContext, Script } from 'node:vm';
import { ScriptConsole, ScriptingContext, ScriptType, VariableMap, VariableObject } from 'shim';
import { EnvironmentMap } from 'shim/objects/environment';
import { getDurationStringFromNow, getSteadyTimestamp } from 'main/util/time-util';
import type { ScriptLogger } from 'main/network/service/request-recorder';
import { ScriptLog } from 'shim/history';
import { CollectionChanges, CommandType } from 'shim/collection-model';

const collectionState = CollectionStateService.instance;

const SCRIPT_TIMEOUT_SECONDS = 5;

/**
 * The variables a script works on. It is a mutable copy of the variables of the open collection,
 * so reads within a script see its own writes.
 */
interface ScriptVariables {
  variables: VariableMap;
  environments: EnvironmentMap;
  selectedEnvironmentKey?: string;
  /** The names of the collection variables the script set. */
  changedVariables: Set<string>;
  /** The names of the variables the script set, by environment key. */
  changedEnvironmentVariables: Map<string, Set<string>>;
}

/**
 * Service for executing user-provided scripts in an isolated VM context.
 * Scripts run in a Node.js vm context with access to the scripting API.
 */
export class ScriptingService {
  public static _instance: ScriptingService | null = null;

  private createApi(script: ScriptType, log: ScriptLogger, state: ScriptVariables) {
    return Object.freeze<ScriptingContext>({
      console: ScriptingService.createConsole(script, log),

      trufos: Object.freeze({
        version: app.getVersion(),

        getCollectionVariable: (name: string) => {
          return ScriptingService.getVariable(state.variables, name);
        },

        setCollectionVariable: (name: string, value: string | VariableObject) => {
          ScriptingService.setVariable(state.variables, name, value);
          state.changedVariables.add(name);
        },

        getEnvironmentVariable: (name: string, environment?: string) => {
          const variables = ScriptingService.getEnvironmentVariables(state, environment);
          return ScriptingService.getVariable(variables ?? {}, name);
        },

        setEnvironmentVariable: (
          name: string,
          value: string | VariableObject,
          environment?: string
        ) => {
          const key = environment ?? state.selectedEnvironmentKey;
          const variables = ScriptingService.getEnvironmentVariables(state, key);
          // like reading, writing to an environment that does not exist has no effect
          ScriptingService.setVariable(variables ?? {}, name, value);
          if (key == null || variables == null) return;
          const changed = state.changedEnvironmentVariables.get(key) ?? new Set<string>();
          state.changedEnvironmentVariables.set(key, changed.add(name));
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

  public static get instance(): ScriptingService {
    if (!ScriptingService._instance) {
      ScriptingService._instance = new ScriptingService();
    }
    return ScriptingService._instance;
  }

  private static getVariable(map: VariableMap, name: string) {
    return map[name]?.value;
  }

  private static setVariable(map: VariableMap, name: string, value: string | VariableObject) {
    if (typeof value === 'string') value = { value };
    VariableObject.parse(value); // validate type and required properties
    map[name] = { ...(map[name] ?? {}), ...value };
  }

  private static getEnvironmentVariables(state: ScriptVariables, name?: string) {
    name ??= state.selectedEnvironmentKey;
    return name == null ? undefined : state.environments[name]?.variables;
  }

  /**
   * Executes a user script. Variables the script changes are applied to the open collection
   * afterwards.
   * @param code the source code of the script
   * @param type the type of the script, used to label its console output
   * @param log receives the console output and errors of the script
   */
  public async executeScript(code: string, type: ScriptType, log: ScriptLogger): Promise<void> {
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

    // the model is frozen, so the script works on a copy
    const { collection, selectedEnvironmentKey } = collectionState.model;
    const state: ScriptVariables = {
      ...structuredClone({
        variables: collection.variables,
        environments: collection.environments,
      }),
      selectedEnvironmentKey,
      changedVariables: new Set(),
      changedEnvironmentVariables: new Map(),
    };
    try {
      const context = createContext(this.createApi(type, log, state), {
        name: 'Trufos Scripting Context',
      });
      const now = getSteadyTimestamp();
      script.runInContext(context, { timeout: SCRIPT_TIMEOUT_SECONDS * 1000 });
      logger.debug(`Script executed successfully after ${getDurationStringFromNow(now)}`);
    } catch (err) {
      logger.info(`Script execution failed with ${errorName(err)}`);
      log({ script: type, level: 'error', args: [err] });
    }

    const changes = ScriptingService.getCollectionChanges(state);
    if (changes == null) return;
    try {
      await collectionState.apply({ type: CommandType.UPDATE_COLLECTION, changes });
    } catch (err) {
      logger.error('Failed to apply the variables changed by a script:', err);
      log({ script: type, level: 'error', args: [err] });
    }
  }

  /**
   * Builds the changes of the collection a script made. Only the variables the script set are
   * applied, on top of the current state, so changes made while the script ran are kept.
   * @returns the changes, or `undefined` if the script set no variables
   */
  private static getCollectionChanges(state: ScriptVariables): CollectionChanges | undefined {
    const { collection } = collectionState.model;
    const changes: CollectionChanges = {};
    if (state.changedVariables.size > 0) {
      changes.variables = ScriptingService.mergeVariables(
        collection.variables,
        state.variables,
        state.changedVariables
      );
    }
    if (state.changedEnvironmentVariables.size > 0) {
      const environments = { ...collection.environments };
      for (const [key, names] of state.changedEnvironmentVariables) {
        const current = environments[key];
        const changed = state.environments[key]?.variables;
        // the environment may have been deleted in the meantime
        if (current == null || changed == null) continue;
        environments[key] = {
          ...current,
          variables: ScriptingService.mergeVariables(current.variables, changed, names),
        };
      }
      changes.environments = environments;
    }
    return changes.variables == null && changes.environments == null ? undefined : changes;
  }

  /** Returns the current variables with the given names replaced by the changed ones. */
  private static mergeVariables(current: VariableMap, changed: VariableMap, names: Set<string>) {
    const variables = { ...current };
    for (const name of names) variables[name] = changed[name];
    return variables;
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
