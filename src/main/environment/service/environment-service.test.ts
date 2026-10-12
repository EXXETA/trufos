import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { freeze } from 'immer';
import { EnvironmentService } from './environment-service';
import { UnmatchedVariableError } from 'template-replace-stream';
import { Collection } from 'shim/objects/collection';
import { VariableObject } from 'shim/objects/variables';
import { randomUUID } from 'node:crypto';
import { getSystemVariables } from './system-variable';
import { CollectionStateService } from 'main/collection-state/collection-state-service';
import { CollectionModel, normalizeCollection } from 'shim/collection-model';
import {
  AuthorizationType,
  BasicAuthorizationInformation,
  BearerAuthorizationInformation,
  InheritAuthorizationInformation,
} from 'shim/objects';

const environmentService = EnvironmentService.instance;

const environmentKey = 'test';
const variableKey = 'var1';
const variableValue = 'some-value';
const collection: Collection = {
  id: randomUUID(),
  type: 'collection',
  title: 'Collection',
  dirPath: '/collection',
  isDefault: false,
  lastModified: 0,
  children: [],
  environments: {
    [environmentKey]: {
      variables: {
        [variableKey]: {
          value: variableValue,
        },
      },
    },
  },
  variables: {},
};

describe('EnvironmentService', () => {
  let model: CollectionModel;

  beforeEach(() => {
    model = normalizeCollection(structuredClone(collection), [], environmentKey);
    vi.spyOn(CollectionStateService.instance, 'model', 'get').mockImplementation(() => model);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('currentEnvironment getter should return the currently selected environment', () => {
    // Act
    let currentEnvironment = environmentService.currentEnvironment;

    // Assert
    expect(currentEnvironment).toEqual(collection.environments[environmentKey]);

    // Arrange
    model.selectedEnvironmentKey = undefined;

    // Act
    currentEnvironment = environmentService.currentEnvironment;

    // Assert
    expect(currentEnvironment).toBeUndefined();
  });

  it('getVariables() should return all currently available variables', () => {
    // Arrange
    const systemVariables = getSystemVariables();

    // Act
    const variables = environmentService.getVariables();

    // Assert
    expect(variables).toEqual([
      ...Object.entries(collection.environments[environmentKey].variables),
      ...Object.entries(collection.variables),
      ...systemVariables,
    ]);
  });

  it('getVariable() should return the first matching variable by the given key', () => {
    // Arrange
    const [key, systemVariable] = getSystemVariables()[0];
    const collectionVariable: VariableObject = { value: randomUUID() };
    const environmentVariable: VariableObject = { value: randomUUID() };
    model.collection.variables[key] = collectionVariable;
    environmentService.currentEnvironment!.variables[key] = environmentVariable;

    // Act
    let result = environmentService.getVariable(key);

    // Assert
    expect(result).toEqual(environmentVariable);

    // Arrange
    delete environmentService.currentEnvironment!.variables[key];

    // Act
    result = environmentService.getVariable(key);

    // Assert
    expect(result).toEqual(collectionVariable);

    // Arrange
    delete model.collection.variables[key];

    // Act
    result = environmentService.getVariable(key);

    // Assert
    expect(result).toEqual(systemVariable);
  });

  it('setVariablesInString() should replace all variable placeholders with their values', async () => {
    // Arrange
    const template = `Replacing {{ ${variableKey} }}`;

    // Act
    const result = await environmentService.setVariablesInString(template);

    // Assert
    expect(result).toBe(`Replacing ${variableValue}`);
  });

  it('getAuthorizationHeader() should return undefined when auth is undefined', async () => {
    // Act
    const result = await environmentService.getAuthorizationHeader();

    // Assert
    expect(result).toBeUndefined();
  });

  it('getAuthorizationHeader() should return undefined for INHERIT when collection has no auth configured', async () => {
    // Arrange
    delete model.collection.auth;
    const auth: InheritAuthorizationInformation = { type: AuthorizationType.INHERIT };

    // Act
    const result = await environmentService.getAuthorizationHeader(auth);

    // Assert
    expect(result).toBeUndefined();
  });

  it('getAuthorizationHeader() should resolve INHERIT authorization from collection auth', async () => {
    // Arrange
    const collectionAuth: BasicAuthorizationInformation = {
      type: AuthorizationType.BASIC,
      username: 'inherit-user',
      password: 'inherit-pass',
    };
    model.collection.auth = collectionAuth;
    const auth: InheritAuthorizationInformation = { type: AuthorizationType.INHERIT };
    const expected = `Basic ${Buffer.from(`${collectionAuth.username}:${collectionAuth.password}`).toString('base64')}`;

    // Act
    const result = await environmentService.getAuthorizationHeader(auth);

    // Assert
    expect(result).toBe(expected);
  });

  it('getAuthorizationHeader() should substitute variables for Basic auth credentials', async () => {
    // Arrange
    environmentService.currentEnvironment!.variables.varUser = { value: 'user1' };
    environmentService.currentEnvironment!.variables.varPass = { value: 'pass1' };
    const auth: BasicAuthorizationInformation = {
      type: AuthorizationType.BASIC,
      username: '{{ varUser }}',
      password: '{{ varPass }}',
    };
    const expected = `Basic ${Buffer.from('user1:pass1').toString('base64')}`;

    // Act
    const result = await environmentService.getAuthorizationHeader(auth);

    // Assert
    expect(result).toBe(expected);
  });

  it('getAuthorizationHeader() should not modify the frozen collection auth', async () => {
    // Arrange
    model.collection.auth = { type: AuthorizationType.BEARER, token: '{{ var1 }}' };
    model = freeze(model, true);
    const auth: InheritAuthorizationInformation = { type: AuthorizationType.INHERIT };

    // Act
    const result = await environmentService.getAuthorizationHeader(auth);

    // Assert
    expect(result).toBe(`Bearer ${variableValue}`);
    expect(model.collection.auth).toEqual({ type: AuthorizationType.BEARER, token: '{{ var1 }}' });
  });

  it('getAuthorizationHeader() should substitute variables inside Bearer token', async () => {
    // Arrange
    environmentService.currentEnvironment!.variables.varToken = { value: 'abc123' };
    const auth: BearerAuthorizationInformation = {
      type: AuthorizationType.BEARER,
      token: 'prefix-{{ varToken }}-suffix',
    };
    const expected = 'Bearer prefix-abc123-suffix';

    // Act
    const result = await environmentService.getAuthorizationHeader(auth);

    // Assert
    expect(result).toBe(expected);
  });

  describe('setVariablesInString() undefined variable handling', () => {
    it('should not throw for undefined variables by default', async () => {
      await expect(environmentService.setVariablesInString('a/{{ missing }}/b')).resolves.toContain(
        'missing'
      );
    });

    it('should throw an UnmatchedVariableError naming the variable when enabled', async () => {
      await expect(
        environmentService.setVariablesInString('a/{{ missing }}/b', true)
      ).rejects.toBeInstanceOf(UnmatchedVariableError);
      await expect(
        environmentService.setVariablesInString('a/{{ missing }}/b', true)
      ).rejects.toHaveProperty('variableName', 'missing');
    });

    it('should not throw when enabled and all variables are defined', async () => {
      await expect(
        environmentService.setVariablesInString(`{{ ${variableKey} }}`, true)
      ).resolves.toBe(variableValue);
    });
  });
});
