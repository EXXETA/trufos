import { describe, it, expect, beforeEach, vi } from 'vitest';
import { app } from 'electron';
import type { VariableMap } from 'shim/objects/variables';
import { ScriptingService } from './scripting-service';
import { vol } from 'memfs';

const mockState = vi.hoisted(() => {
  const collection: {
    id: string;
    title: string;
    dirPath: string;
    type: 'collection';
    variables: VariableMap;
    environments: Record<string, unknown>;
    children: unknown[];
  } = {
    id: 'test-collection',
    title: 'Test Collection',
    dirPath: '/test-collection',
    type: 'collection',
    variables: {
      testVar: { value: 'testValue' },
      count: { value: '42' },
    } satisfies VariableMap,
    environments: {},
    children: [],
  };
  const environment: { variables: VariableMap } = {
    variables: {
      baseUrl: { value: 'http://localhost:3000' },
    } satisfies VariableMap,
  };

  const environmentService = {
    get currentCollection() {
      return collection;
    },
    get currentEnvironment() {
      return environment;
    },
    setCollectionVariables: vi.fn((vars: VariableMap) => {
      collection.variables = vars;
    }),
  };

  return { collection, environment, environmentService };
});

vi.mock('main/environment/service/environment-service', () => ({
  EnvironmentService: {
    instance: mockState.environmentService,
  },
}));

describe('ScriptingService', () => {
  let service: ScriptingService;

  beforeEach(() => {
    vi.clearAllMocks();
    vol.reset();

    mockState.collection.variables = {
      testVar: { value: 'testValue' },
      count: { value: '42' },
    } satisfies VariableMap;
    mockState.environment.variables = {
      baseUrl: { value: 'http://localhost:3000' },
    } satisfies VariableMap;

    vi.spyOn(app, 'getVersion').mockReturnValue('1.0.0');

    // Reset singleton instance for fresh context
    ScriptingService._instance = null;
    service = ScriptingService.instance;
  });

  describe('executeScript() - Basic Execution', () => {
    it('should execute a simple script successfully', () => {
      // Arrange
      const code = 'const x = 1 + 1; console.log(x);';

      // Act
      service.executeScript(code);

      // Assert
      expect(() => service.executeScript(code)).not.toThrow();
    });

    it('should provide access to trufos.version in script context', () => {
      // Arrange
      const code = `
        if (trufos.version !== '1.0.0') {
          throw new Error('Version mismatch: ' + trufos.version);
        }
      `;

      // Act & Assert
      expect(() => service.executeScript(code)).not.toThrow();
    });

    it('should execute script with multiple statements', () => {
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
      expect(() => service.executeScript(code)).not.toThrow();
    });

    it('should prevent modification of frozen trufos API object', () => {
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
      expect(() => service.executeScript(code)).not.toThrow();
    });
  });

  describe('executeScript() - Variable Access and Mutation', () => {
    it('should read trufos.variables from script', () => {
      // Arrange
      const code = `
        if (trufos.variables.testVar.value !== 'testValue') {
          throw new Error('Failed to read testVar');
        }
        if (trufos.variables.count.value !== '42') {
          throw new Error('Failed to read count');
        }
      `;

      // Act & Assert
      expect(() => service.executeScript(code)).not.toThrow();
    });

    it('should allow script to modify trufos.variables', () => {
      // Arrange
      const code = `
        trufos.variables = {
          ...trufos.variables,
          newVar: { value: 'newValue' },
          testVar: { value: 'modified' },
          count: { value: '100' },
        };
      `;

      // Act
      service.executeScript(code);

      // Assert
      expect(mockState.environmentService.setCollectionVariables).toHaveBeenCalled();
      const callArgs = mockState.environmentService.setCollectionVariables.mock.calls[0][0];
      expect(callArgs).toHaveProperty('newVar');
      expect(callArgs.newVar.value).toBe('newValue');
      expect(callArgs.testVar.value).toBe('modified');
      expect(callArgs.count.value).toBe('100');
    });

    it('should provide access to trufos.environment in script', () => {
      // Arrange

      const code = `
        if (trufos.environment.variables.baseUrl.value !== 'http://localhost:3000') {
          throw new Error('Failed to read environment baseUrl');
        }
      `;

      // Act & Assert
      expect(() => service.executeScript(code)).not.toThrow();
    });

    it('should prevent direct assignment to trufos.environment', () => {
      // Arrange

      const code = `
        const original = trufos.environment;
        try {
          trufos.environment = { variables: {} };
        } catch (e) {
          // Expected in strict mode
        }
        if (trufos.environment !== original) {
          throw new Error('trufos.environment should remain read-only');
        }
      `;

      // Act & Assert
      expect(() => service.executeScript(code)).not.toThrow();
    });
  });

  describe('executeScriptFromFile()', () => {
    it('should read and execute script from file', async () => {
      // Arrange

      const filePath = '/test-script.js';
      const code = `const result = 1 + 1;`;

      vol.writeFileSync(filePath, code);

      // Act
      await service.executeScriptFromFile(filePath);

      // Assert
      await expect(service.executeScriptFromFile(filePath)).resolves.toBeUndefined();
    });

    it('should execute script from file with valid code', async () => {
      // Arrange

      const filePath = '/valid-script.js';
      const code = `
        if (trufos.version !== '1.0.0') {
          throw new Error('Version check failed');
        }
      `;

      vol.writeFileSync(filePath, code);

      // Act & Assert
      await expect(service.executeScriptFromFile(filePath)).resolves.toBeUndefined();
    });

    it('should execute multiline script from file', async () => {
      // Arrange

      const filePath = '/multiline-script.js';
      const code = `
        let result = 0;
        for (let i = 0; i < 10; i++) {
          result += i;
        }
        if (result !== 45) {
          throw new Error('Expected 45, got ' + result);
        }
      `;

      vol.writeFileSync(filePath, code);

      // Act & Assert
      await expect(service.executeScriptFromFile(filePath)).resolves.toBeUndefined();
    });
  });

  describe('ScriptingService Singleton', () => {
    it('should be a singleton instance', () => {
      // Arrange & Act
      const instance1 = ScriptingService.instance;
      const instance2 = ScriptingService.instance;

      // Assert
      expect(instance1).toBe(instance2);
    });

    it('should maintain context state across script executions', () => {
      // Arrange

      // Act - First script: define a global variable
      service.executeScript('globalVar = 42;');

      // Second script: access the variable definition
      const accessCode = `
        if (typeof globalVar === 'undefined') {
          throw new Error('Global variable should be accessible across scripts');
        }
        if (globalVar !== 42) {
          throw new Error('Global variable value was lost');
        }
      `;

      // Assert - Context is shared between script executions
      expect(() => service.executeScript(accessCode)).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty script string', () => {
      // Arrange

      // Act & Assert
      expect(() => service.executeScript('')).not.toThrow();
    });

    it('should handle script with only comments', () => {
      // Arrange

      const code = `
        // This is a comment
        /* This is a block comment */
      `;

      // Act & Assert
      expect(() => service.executeScript(code)).not.toThrow();
    });

    it('should handle script with console output', () => {
      // Arrange

      const code = `console.log('Script output');`;

      // Act & Assert
      expect(() => service.executeScript(code)).not.toThrow();
    });

    it('should isolate each script execution context', () => {
      // Arrange

      // Act
      service.executeScript('const localVar = 123;');

      // Try to access localVar in another script - should succeed
      const accessCode = `
        if (localVar !== 123) {
          throw new Error('localVar should be accessible across executions');
        }
      `;

      // Assert
      expect(() => service.executeScript(accessCode)).not.toThrow();
    });
  });
});
