import { app } from 'electron';
import { EnvironmentService } from 'main/environment/service/environment-service';
import { createContext, Script } from 'node:vm';
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

  private get api() {
    return Object.freeze<GlobalScriptingApi>({
      trufos: {
        version: app.getVersion(),

        getCollectionVariable(name: string) {
          return ScriptingService.getVariable(environmentService.currentCollection.variables, name);
        },

        setCollectionVariable(name: string, value: string | VariableObject) {
          ScriptingService.setVariable(environmentService.currentCollection.variables, name, value);
        },

        getEnvironmentVariable(environment, name) {
          const variables = ScriptingService.getEnvironmentVariables(environment);
          return ScriptingService.getVariable(variables, name);
        },

        setEnvironmentVariable(
          environment: string | undefined,
          name: string,
          value: string | VariableObject
        ) {
          const variables = ScriptingService.getEnvironmentVariables(environment);
          ScriptingService.setVariable(variables, name, value);
        },
      },
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
      const context = createContext(this.api, { name: 'Trufos Scripting Context' });
      const now = getSteadyTimestamp();
      script.runInContext(context, { timeout: SCRIPT_TIMEOUT_SECONDS * 1000 });
      logger.debug(`Script executed successfully after ${getDurationStringFromNow(now)}`);
    } catch (err) {
      // TODO: Show error to user instead of just logging it.
      logger.info('Script execution error', err);
    }
  }
}
