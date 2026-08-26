import { describe, expect, it } from 'vitest';
import {
  FALLBACK_TITLE_DIR_NAME,
  MAX_TITLE_DIR_NAME_LENGTH,
  sanitizeTitle,
  truncate,
  uniqueName,
  uniqueNameAsync,
} from './string';

describe('sanitizeTitle', () => {
  it('lowercases the title and replaces whitespace with dashes', () => {
    expect(sanitizeTitle('List All Pets')).toBe('list-all-pets');
  });

  it('replaces characters that are not allowed in file names with dashes', () => {
    expect(sanitizeTitle('GET /pets/{petId}?full=true')).toBe('get-pets-pet-id-full-true');
  });

  it('splits camel case titles into words', () => {
    expect(sanitizeTitle('getAppVersions')).toBe('get-app-versions');
    expect(sanitizeTitle('AppStoreController_getVersions')).toBe(
      'app-store-controller-get-versions'
    );
  });

  it('collapses repeated dashes and removes leading and trailing ones', () => {
    expect(sanitizeTitle('/health')).toBe('health');
    expect(sanitizeTitle('Create application. Optional: none')).toBe(
      'create-application-optional-none'
    );
  });

  it('strips diacritics instead of replacing them with dashes', () => {
    expect(sanitizeTitle('Anwendungen prüfen')).toBe('anwendungen-prufen');
    expect(sanitizeTitle('Créer une application')).toBe('creer-une-application');
    expect(sanitizeTitle('Añadir configuración')).toBe('anadir-configuracion');
  });

  it('falls back to a fixed name if nothing is left after sanitizing', () => {
    // an empty name would make path.join(dir, name) collapse to the parent directory itself
    expect(sanitizeTitle('%$§!')).toBe(FALLBACK_TITLE_DIR_NAME);
    expect(sanitizeTitle('')).toBe(FALLBACK_TITLE_DIR_NAME);
  });

  it('falls back to a fixed name for titles written entirely in a non-Latin script', () => {
    expect(sanitizeTitle('Получить приложения')).toBe(FALLBACK_TITLE_DIR_NAME);
    expect(sanitizeTitle('アプリ一覧')).toBe(FALLBACK_TITLE_DIR_NAME);
  });

  it('truncates titles that are too long to be used as directory name', () => {
    const title = 'a'.repeat(MAX_TITLE_DIR_NAME_LENGTH + 100);
    expect(sanitizeTitle(title)).toBe('a'.repeat(MAX_TITLE_DIR_NAME_LENGTH));
  });

  it('truncates long titles to a name that any common file system accepts', () => {
    // OpenAPI operation summaries may contain the whole endpoint documentation
    const title = `Takes native app file from request and creates new appstore application.
      Optional parameters for the request are:\n
      - changelog: to provide a changelog in form of a text file\n
      - releaseState: the release state the app should be in after creation (DEVELOPMENT, REVIEW, RELEASE)`;

    const name = sanitizeTitle(title);

    // 255 bytes is the maximum file name length of ext4, APFS, HFS+ and NTFS
    expect(Buffer.byteLength(name)).toBeLessThanOrEqual(255);
    expect(name).toBe('takes-native-app-file-from-request-and-creates-new-appstore');
  });

  it('does not end the truncated title with a dash', () => {
    expect(sanitizeTitle('a'.repeat(MAX_TITLE_DIR_NAME_LENGTH - 1) + ' bc')).toBe(
      'a'.repeat(MAX_TITLE_DIR_NAME_LENGTH - 1)
    );
  });
});

describe('uniqueName', () => {
  it('returns the base name if it is free', () => {
    expect(uniqueName('pets', () => false)).toBe('pets');
  });

  it('appends a counter until the name is free', () => {
    const taken = new Set(['pets', 'pets-2']);
    expect(uniqueName('pets', (name) => taken.has(name))).toBe('pets-3');
  });

  it('checks asynchronously in its async variant', async () => {
    await expect(uniqueNameAsync('pets', async (name) => name === 'pets')).resolves.toBe('pets-2');
  });
});

describe('truncate', () => {
  it('returns short text unchanged', () => {
    expect(truncate('List pets', 20, ' ')).toBe('List pets');
  });

  it('returns text of exactly the maximum length unchanged', () => {
    expect(truncate('List pets', 9, ' ')).toBe('List pets');
  });

  it('cuts at the last boundary within the limit', () => {
    expect(truncate('List all pets of a user', 15, ' ')).toBe('List all pets');
  });

  it('cuts hard if the boundary would discard more than half of the limit', () => {
    expect(truncate('Get pneumonoultramicroscopicsilicovolcanoconiosis', 20, ' ')).toBe(
      'Get pneumonoultramic'
    );
  });

  it('does not leave trailing boundaries', () => {
    expect(truncate('a-b-----cd', 8, '-')).toBe('a-b');
  });

  it('returns an empty string if there is no boundary and nothing fits', () => {
    expect(truncate('', 5, ' ')).toBe('');
  });
});
