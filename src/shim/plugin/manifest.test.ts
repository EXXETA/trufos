import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  PluginFileArea,
  PluginManifest,
  type PluginPermission,
  PluginPermissionAccess,
  PluginPermissionScope,
  PluginPermissionText,
} from './manifest';

const MINIMAL_MANIFEST = { id: 'postman', name: 'Postman', version: '1.0.0', engine: '^1.0.0' };

describe('PluginManifest', () => {
  it('fills in the defaults of a minimal manifest', () => {
    expect(PluginManifest.parse(MINIMAL_MANIFEST)).toEqual({
      ...MINIMAL_MANIFEST,
      description: '',
      permissions: [],
      contributes: { importers: [], exporters: [] },
    });
  });

  it('fills in the defaults of a contribution', () => {
    const manifest = PluginManifest.parse({
      ...MINIMAL_MANIFEST,
      contributes: { importers: [{ id: 'collection', name: 'Postman' }] },
    });

    expect(manifest.contributes.importers).toEqual([
      { id: 'collection', name: 'Postman', source: 'file', extensions: [] },
    ]);
  });

  it.each(['Postman', '1postman', 'post_man', 'post.man', ''])('rejects the ID "%s"', (id) => {
    expect(PluginManifest.safeParse({ ...MINIMAL_MANIFEST, id }).success).toBe(false);
  });

  it.each(['1.0', '>=1.0.0', '~1.0.0', '^1', 'latest'])('rejects the engine "%s"', (engine) => {
    expect(PluginManifest.safeParse({ ...MINIMAL_MANIFEST, engine }).success).toBe(false);
  });

  it('accepts the $schema reference of editors', () => {
    const $schema = '../../src/shim/plugin/plugin-manifest.schema.json';

    expect(PluginManifest.parse({ ...MINIMAL_MANIFEST, $schema }).$schema).toBe($schema);
  });

  // Run `yarn test -u` to regenerate the JSON Schema after changing the manifest schema.
  it('matches the generated JSON Schema', async () => {
    const schema = z.toJSONSchema(PluginManifest, { io: 'input' });

    await expect(JSON.stringify(schema, null, 2) + '\n').toMatchFileSnapshot(
      './plugin-manifest.schema.json'
    );
  });

  it('rejects an unknown key', () => {
    expect(PluginManifest.safeParse({ ...MINIMAL_MANIFEST, permision: [] }).success).toBe(false);
  });

  it('rejects duplicate contribution IDs', () => {
    const importer = { id: 'collection', name: 'Postman' };
    const result = PluginManifest.safeParse({
      ...MINIMAL_MANIFEST,
      contributes: { importers: [importer, importer] },
    });

    expect(result.success).toBe(false);
  });
});

describe('PluginPermissionText', () => {
  const { COLLECTION, BODIES, FS, SECRETS, NETWORK, EXEC } = PluginPermissionScope;
  const { READ, WRITE } = PluginPermissionAccess;

  it.each<[string, PluginPermission]>([
    ['collection:read', { scope: COLLECTION, value: READ }],
    ['collection:write', { scope: COLLECTION, value: WRITE }],
    ['bodies:read', { scope: BODIES, value: READ }],
    ['fs:collection', { scope: FS, value: PluginFileArea.COLLECTION }],
    ['fs:pick', { scope: FS, value: PluginFileArea.PICK }],
    ['secrets', { scope: SECRETS }],
    ['network:api.github.com', { scope: NETWORK, value: 'api.github.com' }],
    ['network:*.github.com', { scope: NETWORK, value: '*.github.com' }],
    ['exec:git', { scope: EXEC, value: 'git' }],
  ])('parses "%s"', (text, expected) => {
    expect(PluginPermissionText.parse(text)).toEqual(expected);
  });

  it.each([
    'collection',
    'collection:delete',
    'bodies:write',
    'secrets:all',
    'network:',
    'network:*',
    'network:a.*.com',
    'exec:',
    'exec:rm -rf',
  ])('rejects "%s"', (text) => {
    expect(PluginPermissionText.safeParse(text).success).toBe(false);
  });
});
