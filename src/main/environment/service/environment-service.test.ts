import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EnvironmentService } from './environment-service';
import { Collection, CollectionBase } from 'shim/objects/collection';
import { VariableMap, VariableObject } from 'shim/objects/variables';
import { PersistenceService } from 'main/persistence/service/persistence-service';
import { randomUUID } from 'node:crypto';
import { getSystemVariables } from './system-variable';
import { SettingsObject, SettingsService } from '../../persistence/service/settings-service';

const environmentService = EnvironmentService.instance;

const environmentKey = 'test';
const variableKey = 'var1';
const collection: Partial<Collection> = {
  id: randomUUID(),
  environments: {
    [environmentKey]: {
      variables: {
        [variableKey]: {
          value: 'some-value',
        },
      },
    },
  },
  variables: {},
};

describe('EnvironmentService', () => {
  beforeEach(() => {
    environmentService.changeCollection(structuredClone(collection as Collection));
    environmentService.currentEnvironmentKey = environmentKey;
  });

  it('currentEnvironment getter should return the currently selected environment', () => {
    // Act
    let currentEnvironment = environmentService.currentEnvironment;

    // Assert
    expect(currentEnvironment).toEqual(collection.environments[environmentKey]);

    // Arrange
    environmentService.currentEnvironmentKey = undefined;

    // Act
    currentEnvironment = environmentService.currentEnvironment;

    // Assert
    expect(currentEnvironment).toBeUndefined();
  });

  it('setCollectionVariables() should override all existing collection variables', () => {
    // Arrange
    const newVariables: VariableMap = { newVar: { value: 'new-value' } };

    // Assert
    expect(environmentService.currentCollection.variables).toEqual(collection.variables);

    // Act
    environmentService.setCollectionVariables(newVariables);

    // Assert
    expect(environmentService.currentCollection.variables).toEqual(newVariables);
  });

  it('changeCollection() should load the new collection from PersistenceService', async () => {
    // Arrange
    const newCollection: Partial<Collection> = { id: randomUUID(), dirPath: '/some/path' };
    const loadCollectionSpy = vi
      .spyOn(PersistenceService.instance, 'loadCollection')
      .mockResolvedValueOnce(newCollection as Collection);

    // Act
    const result = await environmentService.changeCollection(newCollection.dirPath);

    // Assert
    expect(loadCollectionSpy).toHaveBeenCalledWith(newCollection.dirPath);
    expect(result).toEqual(newCollection as Collection);
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
    environmentService.currentCollection.variables[key] = collectionVariable;
    environmentService.currentEnvironment.variables[key] = environmentVariable;

    // Act
    let result = environmentService.getVariable(key);

    // Assert
    expect(result).toEqual(environmentVariable);

    // Arrange
    delete environmentService.currentEnvironment.variables[key];

    // Act
    result = environmentService.getVariable(key);

    // Assert
    expect(result).toEqual(collectionVariable);

    // Arrange
    delete environmentService.currentCollection.variables[key];

    // Act
    result = environmentService.getVariable(key);

    // Assert
    expect(result).toEqual(systemVariable);
  });

  it('should load the configured collection from SettingsService', async () => {
    // Arrange
    const getSettingsSpy = vi.spyOn(SettingsService.instance, 'settings', 'get');
    const collectionPath = '/path/to/collection';
    const settings: SettingsObject = { collections: [collectionPath], currentCollectionIndex: 0 };
    getSettingsSpy.mockReturnValueOnce(settings);
    const loadCollectionSpy = vi
      .spyOn(PersistenceService.instance, 'loadCollection')
      .mockResolvedValueOnce(collection as Collection);

    // Act
    await environmentService.init();

    // Assert
    expect(getSettingsSpy).toHaveBeenCalled();
    expect(loadCollectionSpy).toHaveBeenCalledWith(collectionPath);
    expect(environmentService.currentCollection).toEqual(collection);
  });

  it('listCollections() should return all collections that are currently open', async () => {
    // Arrange
    const getSettingsSpy = vi.spyOn(SettingsService.instance, 'settings', 'get');
    const collections: CollectionBase[] = [
      { id: randomUUID(), dirPath: '/path/to/collection1', title: 'Collection 1' },
      { id: randomUUID(), dirPath: '/path/to/collection2', title: 'Collection 2' },
    ];
    const settings: SettingsObject = {
      collections: collections.map((collection) => collection.dirPath),
      currentCollectionIndex: 0,
    };
    getSettingsSpy.mockReturnValueOnce(settings);
    const loadCollectionSpy = vi
      .spyOn(PersistenceService.instance, 'loadCollection')
      .mockImplementation(async (dirPath: string) => {
        const collection = collections.find((collection) => collection.dirPath === dirPath);
        if (!collection) {
          throw new Error(`Collection not found at ${dirPath}`);
        }
        return collection as Collection;
      });

    // Act
    const result = await environmentService.listCollections();

    // Assert
    expect(getSettingsSpy).toHaveBeenCalled();
    expect(loadCollectionSpy).toHaveBeenCalledTimes(settings.collections.length);
    expect(result).toEqual(collections);
  });
});
