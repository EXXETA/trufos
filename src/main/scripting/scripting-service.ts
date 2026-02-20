import { EnvironmentService } from 'main/environment/service/environment-service';

const environmentService = EnvironmentService.instance;

/**
 * Service for executing user-provided scripts in an isolated VM context.
 * Scripts run in a Node.js vm context with access to the scripting API.
 */
export class ScriptingService {
  public static readonly instance = new ScriptingService();
}
