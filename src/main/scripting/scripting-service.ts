import { app } from 'electron';
import { CollectionStateService } from 'main/collection-state/collection-state-service';
import { createContext, Script } from 'node:vm';
import { ScriptConsole, ScriptingContext, ScriptType, VariableMap, VariableObject } from 'shim';
import { EnvironmentMap } from 'shim/objects/environment';
import { getDurationStringFromNow, getSteadyTimestamp } from 'main/util/time-util';
import type { ScriptLogger } from 'main/network/service/request-recorder';
import { ScriptLog } from 'shim/history';

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
  variablesChanged: boolean;
  environmentsChanged: boolean;
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
          state.variablesChanged = true;
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
          const variables = ScriptingService.getEnvironmentVariables(state, environment);
          // like reading, writing to an environment that does not exist has no effect
          ScriptingService.setVariable(variables ?? {}, name, value);
          if (variables != null) state.environmentsChanged = true;
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
      variablesChanged: false,
      environmentsChanged: false,
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

    try {
      if (state.variablesChanged) {
        await collectionState.apply({ type: 'setVariables', variables: state.variables });
      }
      if (state.environmentsChanged) {
        await collectionState.apply({ type: 'setEnvironments', environments: state.environments });
      }
    } catch (err) {
      logger.error('Failed to apply the variables changed by a script:', err);
      log({ script: type, level: 'error', args: [err] });
    }
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
