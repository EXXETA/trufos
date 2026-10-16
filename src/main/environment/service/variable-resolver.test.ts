import { beforeEach, describe, expect, it } from 'vitest';
import { freeze } from 'immer';
import {
  getAuthorizationHeader,
  getVariable,
  getVariables,
  resolveVariablesInString,
} from './variable-resolver';
import { UnmatchedVariableError } from 'template-replace-stream';
import { Collection } from 'shim/objects/collection';
import { VariableObject } from 'shim/objects/variables';
import { randomUUID } from 'node:crypto';
import { getSystemVariables } from './system-variable';
import { CollectionModel, normalizeCollection } from 'shim/collection-model';
import {
  AuthorizationType,
  BasicAuthorizationInformation,
  BearerAuthorizationInformation,
  InheritAuthorizationInformation,
} from 'shim/objects';

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

describe('variable-resolver', () => {
  let model: CollectionModel;

  beforeEach(() => {
    model = normalizeCollection(structuredClone(collection), [], environmentKey);
  });

  const environment = () => model.collection.environments[environmentKey];

  it('getVariables() should return all currently available variables', () => {
    // Arrange
    const systemVariables = getSystemVariables();

    // Act
    const variables = getVariables(model);

    // Assert
    expect(variables).toEqual([
      ...Object.entries(collection.environments[environmentKey].variables),
      ...Object.entries(collection.variables),
      ...systemVariables,
    ]);
  });

  it('getVariable() should skip the environments if none is selected', () => {
    // Arrange
    model.selectedEnvironmentKey = undefined;

    // Act & Assert
    expect(getVariable(model, variableKey)).toBeUndefined();
  });

  it('getVariable() should return the first matching variable by the given key', () => {
    // Arrange
    const [key, systemVariable] = getSystemVariables()[0];
    const collectionVariable: VariableObject = { value: randomUUID() };
    const environmentVariable: VariableObject = { value: randomUUID() };
    model.collection.variables[key] = collectionVariable;
    environment().variables[key] = environmentVariable;

    // Act
    let result = getVariable(model, key);

    // Assert
    expect(result).toEqual(environmentVariable);

    // Arrange
    delete environment().variables[key];

    // Act
    result = getVariable(model, key);

    // Assert
    expect(result).toEqual(collectionVariable);

    // Arrange
    delete model.collection.variables[key];

    // Act
    result = getVariable(model, key);

    // Assert
    expect(result).toEqual(systemVariable);
  });

  it('resolveVariablesInString() should replace all variable placeholders with their values', async () => {
    // Arrange
    const template = `Replacing {{ ${variableKey} }}`;

    // Act
    const result = await resolveVariablesInString(model, template);

    // Assert
    expect(result).toBe(`Replacing ${variableValue}`);
  });

  it('getAuthorizationHeader() should return undefined when auth is undefined', async () => {
    // Act
    const result = await getAuthorizationHeader(model);

    // Assert
    expect(result).toBeUndefined();
  });

  it('getAuthorizationHeader() should return undefined for INHERIT when collection has no auth configured', async () => {
    // Arrange
    delete model.collection.auth;
    const auth: InheritAuthorizationInformation = { type: AuthorizationType.INHERIT };

    // Act
    const result = await getAuthorizationHeader(model, auth);

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
    const result = await getAuthorizationHeader(model, auth);

    // Assert
    expect(result).toBe(expected);
  });

  it('getAuthorizationHeader() should substitute variables for Basic auth credentials', async () => {
    // Arrange
    environment().variables.varUser = { value: 'user1' };
    environment().variables.varPass = { value: 'pass1' };
    const auth: BasicAuthorizationInformation = {
      type: AuthorizationType.BASIC,
      username: '{{ varUser }}',
      password: '{{ varPass }}',
    };
    const expected = `Basic ${Buffer.from('user1:pass1').toString('base64')}`;

    // Act
    const result = await getAuthorizationHeader(model, auth);

    // Assert
    expect(result).toBe(expected);
  });

  it('getAuthorizationHeader() should not modify the frozen collection auth', async () => {
    // Arrange
    model.collection.auth = { type: AuthorizationType.BEARER, token: '{{ var1 }}' };
    model = freeze(model, true);
    const auth: InheritAuthorizationInformation = { type: AuthorizationType.INHERIT };

    // Act
    const result = await getAuthorizationHeader(model, auth);

    // Assert
    expect(result).toBe(`Bearer ${variableValue}`);
    expect(model.collection.auth).toEqual({ type: AuthorizationType.BEARER, token: '{{ var1 }}' });
  });

  it('getAuthorizationHeader() should substitute variables inside Bearer token', async () => {
    // Arrange
    environment().variables.varToken = { value: 'abc123' };
    const auth: BearerAuthorizationInformation = {
      type: AuthorizationType.BEARER,
      token: 'prefix-{{ varToken }}-suffix',
    };
    const expected = 'Bearer prefix-abc123-suffix';

    // Act
    const result = await getAuthorizationHeader(model, auth);

    // Assert
    expect(result).toBe(expected);
  });

  describe('resolveVariablesInString() undefined variable handling', () => {
    it('should not throw for undefined variables by default', async () => {
      await expect(resolveVariablesInString(model, 'a/{{ missing }}/b')).resolves.toContain(
        'missing'
      );
    });

    it('should throw an UnmatchedVariableError naming the variable when enabled', async () => {
      await expect(
        resolveVariablesInString(model, 'a/{{ missing }}/b', true)
      ).rejects.toBeInstanceOf(UnmatchedVariableError);
      await expect(
        resolveVariablesInString(model, 'a/{{ missing }}/b', true)
      ).rejects.toHaveProperty('variableName', 'missing');
    });

    it('should not throw when enabled and all variables are defined', async () => {
      await expect(resolveVariablesInString(model, `{{ ${variableKey} }}`, true)).resolves.toBe(
        variableValue
      );
    });
  });
});
