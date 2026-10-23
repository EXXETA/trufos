import { describe, expect, it, vi } from 'vitest';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PluginManifest } from 'shim/plugin';
import { createPluginHost } from './plugin-host';

function manifest(permissions: string[] = []) {
  return PluginManifest.parse({
    id: 'fake',
    name: 'Fake',
    version: '1.0.0',
    engine: '^1.0.0',
    permissions,
  });
}

describe('createPluginHost', () => {
  it('names the plugin the host is built for', () => {
    const host = createPluginHost(manifest());

    expect(host.pluginId).toBe('fake');
    expect(Object.isFrozen(host)).toBe(true);
  });

  it('logs with the ID of the plugin', () => {
    const host = createPluginHost(manifest());
    const info = vi.spyOn(logger, 'info').mockImplementation(() => logger);

    host.log.info('Hello', 1);

    expect(info).toHaveBeenCalledWith('[PLUGIN fake]: Hello', 1);
  });

  // a plugin can only use what its manifest declares, so the manifest cannot go stale
  it('throws when a capability is used without its permission', () => {
    const host = createPluginHost(manifest());

    expect(() => host.fs).toThrow(
      'The plugin "fake" uses host.fs, but its manifest declares no "fs" permission'
    );
  });

  // spreading, logging or diffing a host must not trip over a capability that throws
  it.each([{ permissions: [] }, { permissions: ['fs:pick'] }])(
    'keeps its capabilities out of enumeration with $permissions',
    ({ permissions }) => {
      const host = createPluginHost(manifest(permissions));

      expect({ ...host }).toEqual({ pluginId: 'fake', log: host.log });
    }
  );

  it.each(['fs:collection', 'fs:pick'])('provides the file system with "%s"', (permission) => {
    const host = createPluginHost(manifest([permission]));

    expect(host.fs).toBeDefined();
    expect(Object.isFrozen(host.fs)).toBe(true);
  });

  it('reads a file as bytes or as text', async () => {
    const host = createPluginHost(manifest(['fs:pick']));
    const filePath = path.join(tmpdir(), 'file.txt');
    await writeFile(filePath, 'content');

    const bytes = await host.fs.readFile(filePath);

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(new Uint8Array(bytes)).toEqual(new TextEncoder().encode('content'));
    expect(await host.fs.readFile(filePath, 'utf8')).toBe('content');
    expect(await host.fs.readFile(filePath, { encoding: 'utf8' })).toBe('content');
  });

  it('writes text', async () => {
    const host = createPluginHost(manifest(['fs:pick']));
    const filePath = path.join(tmpdir(), 'file.txt');

    await host.fs.writeFile(filePath, 'content');

    expect(await readFile(filePath, 'utf8')).toBe('content');
  });

  it('lists a directory by names or by entries', async () => {
    const host = createPluginHost(manifest(['fs:collection']));
    const dirPath = path.join(tmpdir(), 'dir');
    await mkdir(path.join(dirPath, 'sub'), { recursive: true });
    await writeFile(path.join(dirPath, 'file.txt'), '');

    expect((await host.fs.readdir(dirPath)).sort()).toEqual(['file.txt', 'sub']);
    const entries = (await host.fs.readdir(dirPath, { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    expect(entries.map((entry) => [entry.name, entry.isFile(), entry.isDirectory()])).toEqual([
      ['file.txt', true, false],
      ['sub', false, true],
    ]);
  });

  it('stats a file', async () => {
    const host = createPluginHost(manifest(['fs:collection']));
    const filePath = path.join(tmpdir(), 'file.txt');
    await writeFile(filePath, 'content');

    const stats = await host.fs.stat(filePath);

    expect(stats.isFile()).toBe(true);
    expect(stats.isDirectory()).toBe(false);
    expect(stats.size).toBe(7);
  });

  it('writes binary data', async () => {
    const host = createPluginHost(manifest(['fs:pick']));
    const filePath = path.join(tmpdir(), 'file.bin');
    const data = new Uint8Array([0, 1, 2, 255]);

    await host.fs.writeFile(filePath, data);

    expect(new Uint8Array(await readFile(filePath))).toEqual(data);
  });
});
