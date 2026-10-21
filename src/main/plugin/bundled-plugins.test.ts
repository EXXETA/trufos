import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { PluginManifest } from 'shim/plugin';
import testPluginManifest from '../../../plugins/__fixtures__/test-plugin/plugin.json';
import { BUNDLED_PLUGINS } from './bundled-plugins';

describe('BUNDLED_PLUGINS', () => {
  // the manifests are JSON imports and cannot be typed, see BundledPlugin.manifest
  it('have valid manifests', () => {
    const manifests = [testPluginManifest, ...BUNDLED_PLUGINS.map(({ manifest }) => manifest)];

    for (const manifest of manifests) expect(manifest).toBeOfSchema(PluginManifest);
  });

  // a plugin with a taken ID is ignored at runtime, so a bundled one would silently be missing
  it('have unique IDs', () => {
    const ids = BUNDLED_PLUGINS.map(
      ({ manifest }) => z.object({ id: z.string() }).parse(manifest).id
    );

    expect(new Set(ids).size).toBe(ids.length);
  });
});
