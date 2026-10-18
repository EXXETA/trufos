import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { readFile, writeFile } from 'node:fs/promises';
import { USER_DATA_DIR } from 'main/util/fs-util';
import { CollectionUiState } from 'shim/collection-ui-state';
import { StateService, VERSION } from './state-service';

const stateService = StateService.instance;
const { DEFAULT_COLLECTION_DIR } = StateService;
const dirA = path.join(USER_DATA_DIR, 'collections', 'a');
const environments = { dev: { variables: {} }, prod: { variables: {} } };

const readStateFile = async (): Promise<unknown> =>
  JSON.parse(await readFile(StateService.STATE_FILE, 'utf8'));

describe('StateService', () => {
  beforeEach(async () => {
    await stateService.init();
  });

  it('starts with only the default collection open', async () => {
    expect(stateService.openCollections).toEqual([DEFAULT_COLLECTION_DIR]);
    expect(stateService.currentCollection).toBe(DEFAULT_COLLECTION_DIR);
    expect(await readStateFile()).toEqual({
      collections: [{ dirPath: DEFAULT_COLLECTION_DIR }],
      currentCollection: DEFAULT_COLLECTION_DIR,
      version: VERSION.string,
    });
  });

  it('open adds the collection once and makes it current', async () => {
    await stateService.open(dirA);
    await stateService.open(DEFAULT_COLLECTION_DIR);
    await stateService.open(dirA);

    expect(stateService.openCollections).toEqual([DEFAULT_COLLECTION_DIR, dirA]);
    expect(stateService.currentCollection).toBe(dirA);
  });

  it('close forgets the collection with its state and makes the default collection current', async () => {
    await stateService.open(dirA);
    await stateService.selectEnvironment(dirA, 'prod');
    await stateService.saveUiState(dirA, CollectionUiState.parse({ openFolders: ['f1'] }));

    await stateService.close(dirA);

    expect(stateService.openCollections).toEqual([DEFAULT_COLLECTION_DIR]);
    expect(stateService.currentCollection).toBe(DEFAULT_COLLECTION_DIR);
    expect(stateService.uiState(dirA)).toBeUndefined();
    await stateService.open(dirA);
    expect(stateService.selectedEnvironment(dirA, environments)).toBe('dev');
  });

  it('keeps the default collection open', async () => {
    await stateService.close(DEFAULT_COLLECTION_DIR);

    expect(stateService.openCollections).toEqual([DEFAULT_COLLECTION_DIR]);
  });

  it('repairs a stored state that breaks its rules', async () => {
    await writeFile(
      StateService.STATE_FILE,
      JSON.stringify({
        collections: [{ dirPath: dirA }],
        currentCollection: '/gone',
        version: '1.0.0',
      })
    );

    await stateService.init();

    expect(stateService.openCollections).toEqual([DEFAULT_COLLECTION_DIR, dirA]);
    expect(stateService.currentCollection).toBe(DEFAULT_COLLECTION_DIR);
  });

  describe('selectedEnvironment', () => {
    beforeEach(async () => {
      await stateService.open(dirA);
    });

    it('is the first environment if none was stored', () => {
      expect(stateService.selectedEnvironment(dirA, environments)).toBe('dev');
    });

    it('is the stored environment', async () => {
      await stateService.selectEnvironment(dirA, 'prod');

      expect(stateService.selectedEnvironment(dirA, environments)).toBe('prod');
    });

    it('is none if none was selected', async () => {
      await stateService.selectEnvironment(dirA, undefined);

      expect(stateService.selectedEnvironment(dirA, environments)).toBeUndefined();
    });

    it('is the first environment if the stored one no longer exists', async () => {
      await stateService.selectEnvironment(dirA, 'gone');

      expect(stateService.selectedEnvironment(dirA, environments)).toBe('dev');
    });
  });

  it('stores nothing for a collection that is not open', async () => {
    await stateService.selectEnvironment(dirA, 'prod');
    await stateService.saveUiState(dirA, CollectionUiState.parse({}));

    expect(stateService.openCollections).toEqual([DEFAULT_COLLECTION_DIR]);
    expect(stateService.uiState(dirA)).toBeUndefined();
  });

  it('returns a copy of the stored UI state', async () => {
    const uiState = CollectionUiState.parse({ selectedRequestId: 'r1', openFolders: ['f1'] });
    await stateService.open(dirA);
    await stateService.saveUiState(dirA, uiState);

    const stored = stateService.uiState(dirA);

    expect(stored).toEqual(uiState);
    expect(Object.isFrozen(stored)).toBe(false);
    expect(await readStateFile()).toMatchObject({
      collections: [{ dirPath: DEFAULT_COLLECTION_DIR }, { dirPath: dirA, ui: uiState }],
    });
  });
});
