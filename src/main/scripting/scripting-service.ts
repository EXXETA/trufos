import { app } from 'electron';
import { EnvironmentService } from 'main/environment/service/environment-service';
import { Context, createContext, Script } from 'node:vm';
import { GlobalScriptingApi } from 'shim';
import { performance } from 'node:perf_hooks';
import fs from 'node:fs/promises';

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
    const globalApi: GlobalScriptingApi = {
      trufos: {
        version: app.getVersion(),
        get variables() {
          return environmentService.currentCollection.variables;
        },
        set variables(value) {
          environmentService.setCollectionVariables(value);
        },
        get environment() {
          return environmentService.currentEnvironment;
        },
      },
    };
    this.context = createContext(Object.freeze(globalApi));
  }

  private readonly context: Context;

  public async executeScriptFromFile(filePath: string) {
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
    logger.info('Executing script');
    let script: Script;
    try {
      const start = performance.now();
      script = new Script(code);
      const duration = (performance.now() - start).toFixed(2);
      logger.debug(`Script compiled successfully after ${duration}ms`);
    } catch (err) {
      // TODO: Show error to user instead of just logging it.
      logger.info('Script compilation error', err);
      return;
    }
    try {
      const now = performance.now();
      script.runInContext(this.context, { timeout: SCRIPT_TIMEOUT_SECONDS * 1000 });
      const duration = (performance.now() - now).toFixed(2);
      logger.debug(`Script executed successfully after ${duration}ms`);
    } catch (err) {
      // TODO: Show error to user instead of just logging it.
      logger.info('Script execution error', err);
    }
  }
}
