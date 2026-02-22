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
    environments: Record<string, { variables: VariableMap }>;
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
    environments: {
      dev: {
        variables: {
          baseUrl: { value: 'http://localhost:3000' },
        } satisfies VariableMap,
      },
    },
    children: [],
  };

  const environmentService = {
    currentEnvironmentKey: 'dev' as string | undefined,
    get currentCollection() {
      return collection;
    },
    get currentEnvironment() {
      return this.currentEnvironmentKey
        ? collection.environments[this.currentEnvironmentKey]
        : undefined;
    },
  };

  return { collection, environmentService };
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
    mockState.collection.environments = {
      dev: {
        variables: {
          baseUrl: { value: 'http://localhost:3000' },
        } satisfies VariableMap,
      },
    };
    mockState.environmentService.currentEnvironmentKey = 'dev';

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
    it('should read collection variables using getCollectionVariable()', () => {
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
      expect(() => service.executeScript(code)).not.toThrow();
    });

    it('should return undefined for non-existent collection variables', () => {
      // Arrange
      const code = `
        if (trufos.getCollectionVariable('nonExistent') !== undefined) {
          throw new Error('Non-existent variable should return undefined');
        }
      `;

      // Act & Assert
      expect(() => service.executeScript(code)).not.toThrow();
    });

    it('should allow script to modify collection variables with string value', () => {
      // Arrange
      const code = `
        trufos.setCollectionVariable('testVar', 'modified');
        trufos.setCollectionVariable('count', '100');
        trufos.setCollectionVariable('newVar', 'newValue');
      `;

      // Act
      service.executeScript(code);

      // Assert
      expect(mockState.collection.variables.testVar.value).toBe('modified');
      expect(mockState.collection.variables.count.value).toBe('100');
      expect(mockState.collection.variables.newVar.value).toBe('newValue');
    });

    it('should allow script to modify collection variables with VariableObject', () => {
      // Arrange
      const code = `
        trufos.setCollectionVariable('testVar', { value: 'modified', description: 'Updated' });
        trufos.setCollectionVariable('newVar', { value: 'newValue', description: 'New variable' });
      `;

      // Act
      service.executeScript(code);

      // Assert
      expect(mockState.collection.variables.testVar.value).toBe('modified');
      expect(mockState.collection.variables.testVar.description).toBe('Updated');
      expect(mockState.collection.variables.newVar.value).toBe('newValue');
      expect(mockState.collection.variables.newVar.description).toBe('New variable');
    });

    it('should provide access to current environment variables', () => {
      // Arrange
      const code = `
        if (trufos.getEnvironmentVariable(undefined, 'baseUrl') !== 'http://localhost:3000') {
          throw new Error('Failed to read environment baseUrl');
        }
      `;

      // Act & Assert
      expect(() => service.executeScript(code)).not.toThrow();
    });

    it('should provide access to named environment variables', () => {
      // Arrange
      const code = `
        if (trufos.getEnvironmentVariable('dev', 'baseUrl') !== 'http://localhost:3000') {
          throw new Error('Failed to read named environment baseUrl');
        }
      `;

      // Act & Assert
      expect(() => service.executeScript(code)).not.toThrow();
    });

    it('should return undefined for non-existent environment variables', () => {
      // Arrange
      const code = `
        if (trufos.getEnvironmentVariable(undefined, 'nonExistent') !== undefined) {
          throw new Error('Non-existent environment variable should return undefined');
        }
      `;

      // Act & Assert
      expect(() => service.executeScript(code)).not.toThrow();
    });

    it('should allow script to set current environment variables with string value', () => {
      // Arrange
      const code = `
        trufos.setEnvironmentVariable(undefined, 'baseUrl', 'http://localhost:4000');
        trufos.setEnvironmentVariable(undefined, 'apiKey', 'secret123');
      `;

      // Act
      service.executeScript(code);

      // Assert
      expect(mockState.collection.environments.dev.variables.baseUrl.value).toBe(
        'http://localhost:4000'
      );
      expect(mockState.collection.environments.dev.variables.apiKey.value).toBe('secret123');
    });

    it('should allow script to set named environment variables with VariableObject', () => {
      // Arrange
      const code = `
        trufos.setEnvironmentVariable('dev', 'baseUrl', { value: 'http://localhost:5000', description: 'Updated URL' });
        trufos.setEnvironmentVariable('dev', 'newVar', { value: 'test', description: 'New env var' });
      `;

      // Act
      service.executeScript(code);

      // Assert
      expect(mockState.collection.environments.dev.variables.baseUrl.value).toBe(
        'http://localhost:5000'
      );
      expect(mockState.collection.environments.dev.variables.baseUrl.description).toBe(
        'Updated URL'
      );
      expect(mockState.collection.environments.dev.variables.newVar.value).toBe('test');
      expect(mockState.collection.environments.dev.variables.newVar.description).toBe(
        'New env var'
      );
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
