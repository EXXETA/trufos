import { describe, it, expect, beforeEach, vi } from 'vitest';
import { app } from 'electron';
import { ScriptingService } from './scripting-service';
import { vol } from 'memfs';
import type { ScriptLogger } from 'main/network/service/request-recorder';
import { ScriptType } from 'shim/scripting';
import {
  type CollectionCommand,
  type CollectionModel,
  CommandType,
  normalizeCollection,
} from 'shim/collection-model';
import { freeze } from 'immer';

const log = vi.fn<ScriptLogger>();
const COLLECTION_ID = 'collection';

const mockState = vi.hoisted(() => {
  const ref: { model?: CollectionModel } = {};
  const model = () => {
    if (ref.model == null) throw new Error('No model');
    return ref.model;
  };

  class CollectionChangedError extends Error {}

  // applies the commands at once like the real service, so later scripts see the changes
  const apply = vi.fn((command: CollectionCommand): Promise<void> => {
    if (command.type !== CommandType.UPDATE_COLLECTION) return Promise.resolve();
    const { collection } = model();
    const { variables, environments } = command.changes;
    ref.model = {
      ...model(),
      collection: {
        ...collection,
        variables: variables ?? collection.variables,
        environments: environments ?? collection.environments,
      },
    };
    return Promise.resolve();
  });

  const collectionState = {
    apply,
    applyTo: vi.fn(
      async (
        collectionId: string,
        plan: (model: CollectionModel) => CollectionCommand | undefined
      ): Promise<CollectionModel> => {
        if (model().collection.id !== collectionId) throw new CollectionChangedError();
        const command = plan(model());
        if (command != null) await apply(command);
        return model();
      }
    ),
  };

  return { ref, model, collectionState, CollectionChangedError };
});

vi.mock('main/collection-state/collection-state-service', () => ({
  CollectionStateService: {
    instance: mockState.collectionState,
  },
  CollectionChangedError: mockState.CollectionChangedError,
}));

/** Runs a pre-request script and expects it to not report an error. */
async function expectNoError(service: ScriptingService, code: string) {
  await service.executeScript(code, ScriptType.PRE_REQUEST, log, mockState.model());
  expect(log).not.toHaveBeenCalledWith(expect.objectContaining({ level: 'error' }));
}

describe('ScriptingService', () => {
  let service: ScriptingService;

  beforeEach(() => {
    vi.clearAllMocks();
    vol.reset();

    mockState.ref.model = normalizeCollection(
      {
        id: COLLECTION_ID,
        type: 'collection',
        title: 'Collection',
        dirPath: '/collection',
        isDefault: false,
        lastModified: 0,
        children: [],
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
      },
      [],
      'dev'
    );

    vi.spyOn(app, 'getVersion').mockReturnValue('1.0.0');

    service = ScriptingService.instance;
  });

  describe('executeScript(, ScriptType.PRE_REQUEST) - Basic Execution', () => {
    it('should execute a simple script successfully', async () => {
      // Arrange
      const code = 'const x = 1 + 1; console.log(x);';

      // Act
      await service.executeScript(code, ScriptType.PRE_REQUEST, log, mockState.model());

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
      await service.executeScript(
        `console.${method}('token', 42);`,
        ScriptType.PRE_REQUEST,
        log,
        mockState.model()
      );

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
        log,
        mockState.model()
      );

      // Assert
      expect(mockState.model().collection.variables.after?.value).toBe('yes');
    });

    it('should never write console output to the app log', async () => {
      // Arrange
      const appLog = vi.spyOn(logger, 'info');

      // Act
      await service.executeScript(
        `console.log('super-secret-token');`,
        ScriptType.PRE_REQUEST,
        log,
        mockState.model()
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
        log,
        mockState.model()
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
      await service.executeScript(code, ScriptType.PRE_REQUEST, log, mockState.model());

      // Assert
      expect(mockState.model().collection.variables.testVar.value).toBe('modified');
      expect(mockState.model().collection.variables.count.value).toBe('100');
      expect(mockState.model().collection.variables.newVar.value).toBe('newValue');
    });

    it('should allow script to modify collection variables with VariableObject', async () => {
      // Arrange
      const code = `
        trufos.setCollectionVariable('testVar', { value: 'modified', description: 'Updated' });
        trufos.setCollectionVariable('newVar', { value: 'newValue', description: 'New variable' });
      `;

      // Act
      await service.executeScript(code, ScriptType.PRE_REQUEST, log, mockState.model());

      // Assert
      expect(mockState.model().collection.variables.testVar.value).toBe('modified');
      expect(mockState.model().collection.variables.testVar.description).toBe('Updated');
      expect(mockState.model().collection.variables.newVar.value).toBe('newValue');
      expect(mockState.model().collection.variables.newVar.description).toBe('New variable');
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
      await service.executeScript(code, ScriptType.PRE_REQUEST, log, mockState.model());

      // Assert
      expect(mockState.model().collection.environments.dev.variables.baseUrl.value).toBe(
        'http://localhost:4000'
      );
      expect(mockState.model().collection.environments.dev.variables.apiKey.value).toBe(
        'secret123'
      );
    });

    it('should allow script to set named environment variables with VariableObject', async () => {
      // Arrange
      const code = `
        trufos.setEnvironmentVariable('baseUrl', { value: 'http://localhost:5000', description: 'Updated URL' }, 'dev');
        trufos.setEnvironmentVariable('newVar', { value: 'test', description: 'New env var' }, 'dev');
      `;

      // Act
      await service.executeScript(code, ScriptType.PRE_REQUEST, log, mockState.model());

      // Assert
      expect(mockState.model().collection.environments.dev.variables.baseUrl.value).toBe(
        'http://localhost:5000'
      );
      expect(mockState.model().collection.environments.dev.variables.baseUrl.description).toBe(
        'Updated URL'
      );
      expect(mockState.model().collection.environments.dev.variables.newVar.value).toBe('test');
      expect(mockState.model().collection.environments.dev.variables.newVar.description).toBe(
        'New env var'
      );
    });
  });

  describe('executeScript(, ScriptType.PRE_REQUEST) - applying changed variables', () => {
    it('should apply one command when collection variables are set', async () => {
      await service.executeScript(
        `
        trufos.setCollectionVariable('a', '1');
        trufos.setCollectionVariable('b', '2');
      `,
        ScriptType.PRE_REQUEST,
        log,
        mockState.model()
      );

      expect(mockState.collectionState.apply).toHaveBeenCalledOnce();
      expect(mockState.collectionState.apply).toHaveBeenCalledWith({
        type: CommandType.UPDATE_COLLECTION,
        changes: {
          variables: expect.objectContaining({ a: { value: '1' }, b: { value: '2' } }),
        },
      });
    });

    it('should apply one command when an environment variable is set', async () => {
      await service.executeScript(
        `trufos.setEnvironmentVariable('baseUrl', 'http://localhost:9000');`,
        ScriptType.PRE_REQUEST,
        log,
        mockState.model()
      );

      expect(mockState.collectionState.apply).toHaveBeenCalledOnce();
      expect(mockState.collectionState.apply).toHaveBeenCalledWith({
        type: CommandType.UPDATE_COLLECTION,
        changes: {
          environments: { dev: { variables: { baseUrl: { value: 'http://localhost:9000' } } } },
        },
      });
    });

    it('should not apply anything when no variables are set', async () => {
      await service.executeScript(
        `const x = 1 + 1;`,
        ScriptType.PRE_REQUEST,
        log,
        mockState.model()
      );

      expect(mockState.collectionState.apply).not.toHaveBeenCalled();
    });

    it('should not apply anything when setting a variable of a missing environment', async () => {
      await service.executeScript(
        `trufos.setEnvironmentVariable('a', 'b', 'missing');`,
        ScriptType.PRE_REQUEST,
        log,
        mockState.model()
      );

      expect(mockState.collectionState.apply).not.toHaveBeenCalled();
    });

    it('should report a variable change from a callback after the script finished instead of applying it', async () => {
      // Act
      await service.executeScript(
        "Promise.resolve().then(() => trufos.setCollectionVariable('late', 'value'))",
        ScriptType.PRE_REQUEST,
        log,
        mockState.model()
      );
      await new Promise((resolve) => setImmediate(resolve));

      // Assert
      expect(mockState.collectionState.apply).not.toHaveBeenCalled();
      expect(log).toHaveBeenCalledWith(expect.objectContaining({ level: 'error' }));
    });

    it('should not run the script when another collection was opened meanwhile', async () => {
      // Arrange
      const { collection } = mockState.model();
      const closed = { ...mockState.model(), collection: { ...collection, id: 'closed' } };

      // Act & Assert
      await expect(
        service.executeScript(
          `console.log('ran'); trufos.setCollectionVariable('a', 'b');`,
          ScriptType.POST_RESPONSE,
          log,
          closed
        )
      ).rejects.toBeInstanceOf(mockState.CollectionChangedError);
      expect(mockState.collectionState.apply).not.toHaveBeenCalled();
      expect(log).not.toHaveBeenCalled();
    });

    it('should return the model the script left behind', async () => {
      // Act
      const model = await service.executeScript(
        `trufos.setCollectionVariable('a', 'b');`,
        ScriptType.PRE_REQUEST,
        log,
        mockState.model()
      );

      // Assert
      expect(model.collection.variables.a).toEqual({ value: 'b' });
    });

    it('should let a script read its own writes without modifying the frozen model', async () => {
      // Arrange
      const frozen = freeze(structuredClone(mockState.model().collection), true);
      mockState.model().collection = frozen;

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
      expect(mockState.model().collection.variables.testVar.value).toBe('changed');
      expect(mockState.model().collection.environments.dev.variables.baseUrl.value).toBe('changed');
    });

    it('should apply variables and environments with a single command', async () => {
      // Act
      await service.executeScript(
        `
        trufos.setCollectionVariable('a', '1');
        trufos.setEnvironmentVariable('b', '2');
      `,
        ScriptType.PRE_REQUEST,
        log,
        mockState.model()
      );

      // Assert
      expect(mockState.collectionState.apply).toHaveBeenCalledOnce();
      expect(mockState.collectionState.apply).toHaveBeenCalledWith({
        type: CommandType.UPDATE_COLLECTION,
        changes: {
          variables: expect.objectContaining({ a: { value: '1' } }),
          environments: {
            dev: { variables: expect.objectContaining({ b: { value: '2' } }) },
          },
        },
      });
    });

    it('should wait for the variables to be applied', async () => {
      // Arrange
      let persist!: () => void;
      mockState.collectionState.apply.mockReturnValueOnce(
        new Promise<void>((resolve) => (persist = resolve))
      );
      const done = vi.fn();

      // Act
      const executing = service
        .executeScript(
          `trufos.setCollectionVariable('a', 'b');`,
          ScriptType.PRE_REQUEST,
          log,
          mockState.model()
        )
        .then(done);
      await new Promise((resolve) => setImmediate(resolve));

      // Assert
      expect(persist).toBeDefined();
      expect(done).not.toHaveBeenCalled();
      persist();
      await executing;
      expect(done).toHaveBeenCalled();
      expect(log).not.toHaveBeenCalled();
    });

    it('should only log a failure to write the variables to disk to the app log', async () => {
      // Arrange
      const error = vi.spyOn(logger, 'error');
      mockState.collectionState.apply.mockRejectedValueOnce(new Error('disk full'));

      const before = mockState.model();

      // Act
      const model = await service.executeScript(
        `trufos.setCollectionVariable('a', 'b');`,
        ScriptType.PRE_REQUEST,
        log,
        before
      );
      await new Promise((resolve) => setImmediate(resolve));

      // Assert
      expect(model).toBe(before);
      expect(log).not.toHaveBeenCalled();
      expect(error).toHaveBeenCalled();
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
      await service.executeScript(
        'globalVar = 42;',
        ScriptType.PRE_REQUEST,
        log,
        mockState.model()
      );

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
      await service.executeScript(
        'const key = "counter";',
        ScriptType.PRE_REQUEST,
        log,
        mockState.model()
      );

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
        log,
        mockState.model()
      );

      // Verify the collection variable was set
      expect(mockState.model().collection.variables.counter.value).toBe('1');

      // Second script: use trufos API - should work because trufos is always available
      const secondCode = `
        const currentValue = trufos.getCollectionVariable('counter');
        trufos.setCollectionVariable('counter', String(parseInt(currentValue) + 1));
      `;

      // Assert
      await expectNoError(service, secondCode);
      expect(mockState.model().collection.variables.counter.value).toBe('2');
    });
  });
});
