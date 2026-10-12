import { describe, it, expect, beforeEach, vi } from 'vitest';
import { app } from 'electron';
import type { VariableMap } from 'shim/objects/variables';
import { ScriptingService } from './scripting-service';
import { vol } from 'memfs';
import type { ScriptLogger } from 'main/network/service/request-recorder';
import { ScriptType } from 'shim/scripting';
import type { CollectionCommand } from 'shim/collection-model';
import { freeze } from 'immer';

const log = vi.fn<ScriptLogger>();

const mockState = vi.hoisted(() => {
  const state: {
    collection: {
      variables: VariableMap;
      environments: Record<string, { variables: VariableMap }>;
    };
    selectedEnvironmentKey?: string;
  } = {
    collection: { variables: {}, environments: {} },
    selectedEnvironmentKey: 'dev',
  };

  const collectionState = {
    get model() {
      return state;
    },
    // applies the commands like the real service, so later scripts see the changes
    apply: vi.fn(async (command: CollectionCommand) => {
      if (command.type === 'setVariables') {
        state.collection = { ...state.collection, variables: command.variables };
      } else if (command.type === 'setEnvironments') {
        state.collection = { ...state.collection, environments: command.environments };
      }
    }),
  };

  return { state, collectionState };
});

vi.mock('main/collection-state/collection-state-service', () => ({
  CollectionStateService: {
    instance: mockState.collectionState,
  },
}));

/** Runs a pre-request script and expects it to not report an error. */
async function expectNoError(service: ScriptingService, code: string) {
  await service.executeScript(code, ScriptType.PRE_REQUEST, log);
  expect(log).not.toHaveBeenCalledWith(expect.objectContaining({ level: 'error' }));
}

describe('ScriptingService', () => {
  let service: ScriptingService;

  beforeEach(() => {
    vi.clearAllMocks();
    vol.reset();

    mockState.state.collection = {
      variables: {
        testVar: { value: 'testValue' },
        count: { value: '42' },
      },
      environments: {
        dev: {
          variables: {
            baseUrl: { value: 'http://localhost:3000' },
          },
        },
      },
    };
    mockState.state.selectedEnvironmentKey = 'dev';

    vi.spyOn(app, 'getVersion').mockReturnValue('1.0.0');

    // Reset singleton instance for fresh context
    ScriptingService._instance = null;
    service = ScriptingService.instance;
  });

  describe('executeScript(, ScriptType.PRE_REQUEST) - Basic Execution', () => {
    it('should execute a simple script successfully', async () => {
      // Arrange
      const code = 'const x = 1 + 1; console.log(x);';

      // Act
      await service.executeScript(code, ScriptType.PRE_REQUEST, log);

      // Assert
      await expectNoError(service, code);
    });

    it('should provide access to trufos.version in script context', async () => {
      // Arrange
      const code = `
        if (trufos.version !== '1.0.0') {
          throw new Error('Version mismatch: ' + trufos.version);
        }
      `;

      // Act & Assert
      await expectNoError(service, code);
    });

    it('should execute script with multiple statements', async () => {
      // Arrange
      const code = `
        let result = 0;
        for (let i = 0; i < 5; i++) {
          result += i;
        }
        if (result !== 10) {
          throw new Error('Expected 10, got ' + result);
        }
      `;

      // Act & Assert
      await expectNoError(service, code);
    });

    it('should prevent modification of frozen trufos API object', async () => {
      // Arrange
      const code = `
        const original = trufos.version;
        try {
          trufos.version = '2.0.0';
        } catch (e) {
          // Expected in strict mode
        }
        if (trufos.version !== original) {
          throw new Error('trufos.version should remain read-only');
        }
      `;

      // Act & Assert
      await expectNoError(service, code);
    });
  });

  describe('executeScript(, ScriptType.PRE_REQUEST) - console', () => {
    it.each([
      ['log', 'info'],
      ['info', 'info'],
      ['debug', 'debug'],
      ['warn', 'warn'],
      ['error', 'error'],
    ] as const)('should pass console.%s to the logger as %s', async (method, level) => {
      // Arrange

      // Act
      await service.executeScript(`console.${method}('token', 42);`, ScriptType.PRE_REQUEST, log);

      // Assert
      expect(log).toHaveBeenCalledWith({
        script: ScriptType.PRE_REQUEST,
        level,
        args: ['token', 42],
      });
    });

    it('should keep running the script after logging', async () => {
      // Act
      await service.executeScript(
        `console.log('before'); trufos.setCollectionVariable('after', 'yes');`,
        ScriptType.PRE_REQUEST,
        log
      );

      // Assert
      expect(mockState.state.collection.variables.after?.value).toBe('yes');
    });

    it('should never write console output to the app log', async () => {
      // Arrange
      const appLog = vi.spyOn(logger, 'info');

      // Act
      await service.executeScript(
        `console.log('super-secret-token');`,
        ScriptType.PRE_REQUEST,
        log
      );

      // Assert
      expect(
        appLog.mock.calls.flat().some((arg) => String(arg).includes('super-secret-token'))
      ).toBe(false);
    });

    it('should pass errors to the logger but only the error type to the app log', async () => {
      // Arrange
      const appLog = vi.spyOn(logger, 'info');

      // Act
      await service.executeScript(
        `throw new Error('super-secret-token');`,
        ScriptType.POST_RESPONSE,
        log
      );

      // Assert
      expect(log).toHaveBeenCalledWith({
        script: ScriptType.POST_RESPONSE,
        level: 'error',
        args: [expect.objectContaining({ message: 'super-secret-token' })],
      });
      expect(appLog).toHaveBeenCalledWith('Script execution failed with Error');
      expect(
        appLog.mock.calls.flat().some((arg) => String(arg).includes('super-secret-token'))
      ).toBe(false);
    });
  });

  describe('executeScript(, ScriptType.PRE_REQUEST) - Variable Access and Mutation', () => {
    it('should read collection variables using getCollectionVariable()', async () => {
      // Arrange
      const code = `
        if (trufos.getCollectionVariable('testVar') !== 'testValue') {
          throw new Error('Failed to read testVar');
        }
        if (trufos.getCollectionVariable('count') !== '42') {
          throw new Error('Failed to read count');
        }
      `;

      // Act & Assert
      await expectNoError(service, code);
    });

    it('should return undefined for non-existent collection variables', async () => {
      // Arrange
      const code = `
        if (trufos.getCollectionVariable('nonExistent') !== undefined) {
          throw new Error('Non-existent variable should return undefined');
        }
      `;

      // Act & Assert
      await expectNoError(service, code);
    });

    it('should allow script to modify collection variables with string value', async () => {
      // Arrange
      const code = `
        trufos.setCollectionVariable('testVar', 'modified');
        trufos.setCollectionVariable('count', '100');
        trufos.setCollectionVariable('newVar', 'newValue');
      `;

      // Act
      await service.executeScript(code, ScriptType.PRE_REQUEST, log);

      // Assert
      expect(mockState.state.collection.variables.testVar.value).toBe('modified');
      expect(mockState.state.collection.variables.count.value).toBe('100');
      expect(mockState.state.collection.variables.newVar.value).toBe('newValue');
    });

    it('should allow script to modify collection variables with VariableObject', async () => {
      // Arrange
      const code = `
        trufos.setCollectionVariable('testVar', { value: 'modified', description: 'Updated' });
        trufos.setCollectionVariable('newVar', { value: 'newValue', description: 'New variable' });
      `;

      // Act
      await service.executeScript(code, ScriptType.PRE_REQUEST, log);

      // Assert
      expect(mockState.state.collection.variables.testVar.value).toBe('modified');
      expect(mockState.state.collection.variables.testVar.description).toBe('Updated');
      expect(mockState.state.collection.variables.newVar.value).toBe('newValue');
      expect(mockState.state.collection.variables.newVar.description).toBe('New variable');
    });

    it('should provide access to current environment variables', async () => {
      // Arrange
      const code = `
        if (trufos.getEnvironmentVariable('baseUrl') !== 'http://localhost:3000') {
          throw new Error('Failed to read environment baseUrl');
        }
      `;

      // Act & Assert
      await expectNoError(service, code);
    });

    it('should provide access to named environment variables', async () => {
      // Arrange
      const code = `
        if (trufos.getEnvironmentVariable('baseUrl', 'dev') !== 'http://localhost:3000') {
          throw new Error('Failed to read named environment baseUrl');
        }
      `;

      // Act & Assert
      await expectNoError(service, code);
    });

    it('should return undefined for non-existent environment variables', async () => {
      // Arrange
      const code = `
        if (trufos.getEnvironmentVariable('nonExistent') !== undefined) {
          throw new Error('Non-existent environment variable should return undefined');
        }
      `;

      // Act & Assert
      await expectNoError(service, code);
    });

    it('should allow script to set current environment variables with string value', async () => {
      // Arrange
      const code = `
        trufos.setEnvironmentVariable('baseUrl', 'http://localhost:4000');
        trufos.setEnvironmentVariable('apiKey', 'secret123');
      `;

      // Act
      await service.executeScript(code, ScriptType.PRE_REQUEST, log);

      // Assert
      expect(mockState.state.collection.environments.dev.variables.baseUrl.value).toBe(
        'http://localhost:4000'
      );
      expect(mockState.state.collection.environments.dev.variables.apiKey.value).toBe('secret123');
    });

    it('should allow script to set named environment variables with VariableObject', async () => {
      // Arrange
      const code = `
        trufos.setEnvironmentVariable('baseUrl', { value: 'http://localhost:5000', description: 'Updated URL' }, 'dev');
        trufos.setEnvironmentVariable('newVar', { value: 'test', description: 'New env var' }, 'dev');
      `;

      // Act
      await service.executeScript(code, ScriptType.PRE_REQUEST, log);

      // Assert
      expect(mockState.state.collection.environments.dev.variables.baseUrl.value).toBe(
        'http://localhost:5000'
      );
      expect(mockState.state.collection.environments.dev.variables.baseUrl.description).toBe(
        'Updated URL'
      );
      expect(mockState.state.collection.environments.dev.variables.newVar.value).toBe('test');
      expect(mockState.state.collection.environments.dev.variables.newVar.description).toBe(
        'New env var'
      );
    });
  });

  describe('executeScript(, ScriptType.PRE_REQUEST) - applying changed variables', () => {
    it('should apply one setVariables command when collection variables are set', async () => {
      await service.executeScript(
        `
        trufos.setCollectionVariable('a', '1');
        trufos.setCollectionVariable('b', '2');
      `,
        ScriptType.PRE_REQUEST,
        log
      );

      expect(mockState.collectionState.apply).toHaveBeenCalledOnce();
      expect(mockState.collectionState.apply).toHaveBeenCalledWith({
        type: 'setVariables',
        variables: expect.objectContaining({ a: { value: '1' }, b: { value: '2' } }),
      });
    });

    it('should apply one setEnvironments command when an environment variable is set', async () => {
      await service.executeScript(
        `trufos.setEnvironmentVariable('baseUrl', 'http://localhost:9000');`,
        ScriptType.PRE_REQUEST,
        log
      );

      expect(mockState.collectionState.apply).toHaveBeenCalledOnce();
      expect(mockState.collectionState.apply).toHaveBeenCalledWith({
        type: 'setEnvironments',
        environments: { dev: { variables: { baseUrl: { value: 'http://localhost:9000' } } } },
      });
    });

    it('should not apply anything when no variables are set', async () => {
      await service.executeScript(`const x = 1 + 1;`, ScriptType.PRE_REQUEST, log);

      expect(mockState.collectionState.apply).not.toHaveBeenCalled();
    });

    it('should not apply anything when setting a variable of a missing environment', async () => {
      await service.executeScript(
        `trufos.setEnvironmentVariable('a', 'b', 'missing');`,
        ScriptType.PRE_REQUEST,
        log
      );

      expect(mockState.collectionState.apply).not.toHaveBeenCalled();
    });

    it('should let a script read its own writes without modifying the frozen model', async () => {
      // Arrange
      const frozen = freeze(structuredClone(mockState.state.collection), true);
      mockState.state.collection = frozen;

      // Act
      await expectNoError(
        service,
        `
        trufos.setCollectionVariable('testVar', 'changed');
        if (trufos.getCollectionVariable('testVar') !== 'changed') throw new Error('not changed');
        trufos.setEnvironmentVariable('baseUrl', 'changed');
        if (trufos.getEnvironmentVariable('baseUrl') !== 'changed') throw new Error('not changed');
      `
      );

      // Assert
      expect(frozen.variables.testVar.value).toBe('testValue');
      expect(mockState.state.collection.variables.testVar.value).toBe('changed');
      expect(mockState.state.collection.environments.dev.variables.baseUrl.value).toBe('changed');
    });

    it('should report a failure to apply the variables to the script log', async () => {
      // Arrange
      const failure = new Error('failed');
      mockState.collectionState.apply.mockRejectedValueOnce(failure);

      // Act
      await service.executeScript(
        `trufos.setCollectionVariable('a', 'b');`,
        ScriptType.PRE_REQUEST,
        log
      );

      // Assert
      expect(log).toHaveBeenCalledWith({
        script: ScriptType.PRE_REQUEST,
        level: 'error',
        args: [failure],
      });
    });
  });

  describe('ScriptingService Singleton', () => {
    it('should be a singleton instance', async () => {
      // Arrange & Act
      const instance1 = ScriptingService.instance;
      const instance2 = ScriptingService.instance;

      // Assert
      expect(instance1).toBe(instance2);
    });

    it('should NOT persist variables across script executions', async () => {
      // Arrange

      // Act - First script: define a global variable
      await service.executeScript('globalVar = 42;', ScriptType.PRE_REQUEST, log);

      // Second script: try to access the variable from the first script
      const accessCode = `
        if (typeof globalVar !== 'undefined') {
          throw new Error('Variables should NOT persist across script executions');
        }
      `;

      // Assert - Each execution gets a fresh context
      await expectNoError(service, accessCode);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty script string', async () => {
      // Arrange

      // Act & Assert
      await expectNoError(service, '');
    });

    it('should handle script with only comments', async () => {
      // Arrange

      const code = `
        // This is a comment
        /* This is a block comment */
      `;

      // Act & Assert
      await expectNoError(service, code);
    });

    it('should allow same const variable names in different script executions', async () => {
      // Arrange

      // Act - First script: declare a const variable
      await service.executeScript('const key = "counter";', ScriptType.PRE_REQUEST, log);

      // Second script: declare same const variable - should NOT throw "already declared" error
      const secondCode = `const key = "counter";`;

      // Assert - Should not throw because each execution gets a fresh context
      await expectNoError(service, secondCode);
    });

    it('should provide fresh trufos API in each script execution', async () => {
      // Arrange

      // Act - First script: use trufos API
      await service.executeScript(
        `trufos.setCollectionVariable('counter', '1');`,
        ScriptType.PRE_REQUEST,
        log
      );

      // Verify the collection variable was set
      expect(mockState.state.collection.variables.counter.value).toBe('1');

      // Second script: use trufos API - should work because trufos is always available
      const secondCode = `
        const currentValue = trufos.getCollectionVariable('counter');
        trufos.setCollectionVariable('counter', String(parseInt(currentValue) + 1));
      `;

      // Assert
      await expectNoError(service, secondCode);
      expect(mockState.state.collection.variables.counter.value).toBe('2');
    });
  });
});
