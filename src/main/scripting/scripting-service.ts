import { app } from 'electron';
import { EnvironmentService } from 'main/environment/service/environment-service';
import { createContext, Script } from 'node:vm';
import { GlobalScriptingApi, ScriptConsole, ScriptType, VariableMap, VariableObject } from 'shim';
import fs from 'node:fs/promises';
import { getDurationStringFromNow, getSteadyTimestamp } from 'main/util/time-util';
import { EventEmitter } from 'node:events';
import { HistoryService } from 'main/history/history-service';
import { ScriptLog } from 'shim/history';

const environmentService = EnvironmentService.instance;

const SCRIPT_TIMEOUT_SECONDS = 5;

/** Event signatures emitted by the {@link ScriptingService}. */
type ScriptingServiceEvents = {
  'variables-changed': [];
};

/**
 * Service for executing user-provided scripts in an isolated VM context.
 * Scripts run in a Node.js vm context with access to the scripting API.
 */
export class ScriptingService extends EventEmitter<ScriptingServiceEvents> {
  public static _instance: ScriptingService | null = null;
  private _variablesChanged = false;

  private createApi(script?: ScriptType) {
    // Arrow functions so the API methods keep this service as their `this`.
    return Object.freeze<GlobalScriptingApi>({
      console: ScriptingService.createConsole(script),

      trufos: {
        version: app.getVersion(),

        getCollectionVariable: (name: string) => {
          return ScriptingService.getVariable(environmentService.currentCollection.variables, name);
        },

        setCollectionVariable: (name: string, value: string | VariableObject) => {
          ScriptingService.setVariable(environmentService.currentCollection.variables, name, value);
          this._variablesChanged = true;
        },

        getEnvironmentVariable: (name: string, environment?: string) => {
          const variables = ScriptingService.getEnvironmentVariables(environment);
          return ScriptingService.getVariable(variables, name);
        },

        setEnvironmentVariable: (
          name: string,
          value: string | VariableObject,
          environment?: string
        ) => {
          const variables = ScriptingService.getEnvironmentVariables(environment);
          ScriptingService.setVariable(variables, name, value);
          this._variablesChanged = true;
        },
      },
    });
  }

  /**
   * Creates the console of a script. Its output only goes to the request history, never to the app
   * log, because scripts commonly log secrets like tokens.
   */
  private static createConsole(script?: ScriptType): ScriptConsole {
    const log =
      (level: ScriptLog['level']) =>
      (...args: unknown[]) =>
        HistoryService.instance.recordScriptLog({ script, level, args });
    return Object.freeze({
      log: log('info'),
      info: log('info'),
      debug: log('debug'),
      warn: log('warn'),
      error: log('error'),
    });
  }

  public static get instance() {
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

  private static getEnvironmentVariables(name?: string) {
    const environment =
      name == null
        ? environmentService.currentEnvironment
        : environmentService.currentCollection.environments[name];
    return environment?.variables ?? {};
  }

  public async executeScriptFromFile(filePath: string, type?: ScriptType): Promise<void> {
    logger.info(`Executing script from file: ${filePath}`);
    let code: string;
    try {
      code = await fs.readFile(filePath, 'utf-8');
    } catch (err) {
      logger.error('Failed to read script file:', err);
      return;
    }
    this.executeScript(code, type);
  }

  /**
   * Executes a user script.
   * @param code the source code of the script
   * @param type the type of the script, used to label its console output
   */
  public executeScript(code: string, type?: ScriptType): void {
    let script: Script;
    try {
      const now = getSteadyTimestamp();
      script = new Script(code);
      logger.debug(`Script compiled successfully after ${getDurationStringFromNow(now)}`);
    } catch (err) {
      logger.info(`Script compilation failed with ${errorName(err)}`);
      HistoryService.instance.recordScriptLog({ script: type, level: 'error', args: [err] });
      return;
    }
    this._variablesChanged = false;
    try {
      const context = createContext(this.createApi(type), { name: 'Trufos Scripting Context' });
      const now = getSteadyTimestamp();
      script.runInContext(context, { timeout: SCRIPT_TIMEOUT_SECONDS * 1000 });
      logger.debug(`Script executed successfully after ${getDurationStringFromNow(now)}`);
    } catch (err) {
      logger.info(`Script execution failed with ${errorName(err)}`);
      HistoryService.instance.recordScriptLog({ script: type, level: 'error', args: [err] });
    }
    if (this._variablesChanged) {
      this.emit('variables-changed');
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
