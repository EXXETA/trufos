import { app } from 'electron';
import { EnvironmentService } from 'main/environment/service/environment-service';
import { Context, createContext, Script } from 'node:vm';
import { GlobalScriptingApi, VariableMap, VariableObject } from 'shim';
import fs from 'node:fs/promises';
import { getDurationStringFromNow, getSteadyTimestamp } from 'main/util/time-util';

const environmentService = EnvironmentService.instance;

const SCRIPT_TIMEOUT_SECONDS = 5;

/**
 * Service for executing user-provided scripts in an isolated VM context.
 * Scripts run in a Node.js vm context with access to the scripting API.
 */
export class ScriptingService {
  public static _instance: ScriptingService | null = null;

  public static get instance() {
    if (!ScriptingService._instance) {
      ScriptingService._instance = new ScriptingService();
    }
    return ScriptingService._instance;
  }

  constructor() {
    function getVariable(map: VariableMap, name: string) {
      return map[name]?.value;
    }

    function setVariable(map: VariableMap, name: string, value: string | VariableObject) {
      if (typeof value === 'string') value = { value };
      VariableObject.parse(value); // validate type and required properties
      map[name] = { ...(map[name] ?? {}), ...value };
    }

    function getEnvironmentVariables(name?: string) {
      const environment =
        name == null
          ? environmentService.currentEnvironment
          : environmentService.currentCollection.environments[name];
      return environment?.variables ?? {};
    }

    const globalApi: GlobalScriptingApi = {
      trufos: {
        version: app.getVersion(),

        getCollectionVariable(name: string) {
          return getVariable(environmentService.currentCollection.variables, name);
        },

        setCollectionVariable(name: string, value: string | VariableObject) {
          setVariable(environmentService.currentCollection.variables, name, value);
        },

        getEnvironmentVariable(environment, name) {
          return getVariable(getEnvironmentVariables(environment), name);
        },

        setEnvironmentVariable(
          environment: string | undefined,
          name: string,
          value: string | VariableObject
        ) {
          setVariable(getEnvironmentVariables(environment), name, value);
        },
      },
    };
    this.context = createContext(Object.freeze(globalApi));
  }

  private readonly context: Context;

  public async executeScriptFromFile(filePath: string) {
    logger.info(`Executing script from file: ${filePath}`);
    let code: string;
    try {
      code = await fs.readFile(filePath, 'utf-8');
    } catch (err) {
      logger.error('Failed to read script file:', err);
      return;
    }
    this.executeScript(code);
  }

  public executeScript(code: string) {
    let script: Script;
    try {
      const now = getSteadyTimestamp();
      script = new Script(code);
      logger.debug(`Script compiled successfully after ${getDurationStringFromNow(now)}`);
    } catch (err) {
      // TODO: Show error to user instead of just logging it.
      logger.info('Script compilation error', err);
      return;
    }
    try {
      const now = getSteadyTimestamp();
      script.runInContext(this.context, { timeout: SCRIPT_TIMEOUT_SECONDS * 1000 });
      logger.debug(`Script executed successfully after ${getDurationStringFromNow(now)}`);
    } catch (err) {
      // TODO: Show error to user instead of just logging it.
      logger.info('Script execution error', err);
    }
  }
}
