import path from 'node:path';
import { tmpdir } from 'node:os';
import { readFile, writeFile } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { FileSystemService } from 'main/filesystem/filesystem-service';
import { SemVer } from 'main/util/semver';
import { JsonFile, JsonFileMigrator } from './json-file';

const filePath = path.join(tmpdir(), 'file.json');

const Content = z.object({
  name: z.string().default('default'),
  tags: z.array(z.string()).default(() => []),
});
type Content = z.infer<typeof Content>;

/** Version 1.0.0 called the name `title`. */
const fromV1: JsonFileMigrator = (old) => ({
  name: z.object({ title: z.string() }).parse(old).title,
  version: '2.0.0',
});

const createFile = () =>
  new JsonFile<Content>({
    filePath,
    version: new SemVer(2, 0, 0),
    schema: Content,
    migrators: { '1.0.0': fromV1 },
  });

const readJson = async (): Promise<unknown> => JSON.parse(await readFile(filePath, 'utf8'));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('JsonFile', () => {
  it('creates the file with the default content if there is none', async () => {
    const file = createFile();

    await file.init();

    expect(file.value).toEqual({ name: 'default', tags: [] });
    expect(await readJson()).toEqual({ name: 'default', tags: [], version: '2.0.0' });
  });

  it('reads the content of the file', async () => {
    await writeFile(filePath, JSON.stringify({ name: 'stored', tags: ['a'], version: '2.0.0' }));
    const file = createFile();

    await file.init();

    expect(file.value).toEqual({ name: 'stored', tags: ['a'] });
  });

  it('migrates the content of an older version', async () => {
    await writeFile(filePath, JSON.stringify({ title: 'old', version: '1.0.0' }));
    const file = createFile();

    await file.init();

    expect(file.value).toEqual({ name: 'old', tags: [] });
  });

  it('throws if the version cannot be migrated', async () => {
    await writeFile(filePath, JSON.stringify({ version: '0.1.0' }));

    await expect(createFile().init()).rejects.toThrow('No migrator found for version 0.1.0');
  });

  it.each([
    ['no JSON', '{'],
    ['empty', ''],
    ['without a version', JSON.stringify({ name: 'stored' })],
    ['invalid', JSON.stringify({ name: 42, version: '2.0.0' })],
  ])('replaces a file that is %s with the default content', async (_, text) => {
    await writeFile(filePath, text);
    const file = createFile();

    await file.init();

    expect(file.value).toEqual({ name: 'default', tags: [] });
    expect(await readJson()).toEqual({ name: 'default', tags: [], version: '2.0.0' });
  });

  it('update changes the content and writes the file', async () => {
    const file = createFile();
    await file.init();

    await file.update((content) => {
      content.tags.push('a');
    });

    expect(file.value).toEqual({ name: 'default', tags: ['a'] });
    expect(await readJson()).toEqual({ name: 'default', tags: ['a'], version: '2.0.0' });
  });

  it('update rejects invalid content without changing anything', async () => {
    const file = createFile();
    await file.init();
    const replaceFile = vi.spyOn(FileSystemService.instance, 'replaceFile');

    await expect(
      file.update((content) => {
        content.tags = [42] as never;
      })
    ).rejects.toThrow(z.ZodError);

    expect(file.value).toEqual({ name: 'default', tags: [] });
    expect(replaceFile).not.toHaveBeenCalled();
  });

  it('applies the transforms of the schema to every change', async () => {
    const file = new JsonFile({
      filePath,
      version: new SemVer(1, 0, 0),
      schema: Content.transform((content) => ({ ...content, tags: [...new Set(content.tags)] })),
    });
    await file.init();

    await file.update((content) => {
      content.tags.push('a', 'a');
    });

    expect(file.value.tags).toEqual(['a']);
  });

  it('creates a missing file with the default content, not the content in memory', async () => {
    const file = createFile();
    await file.set({ name: 'changed', tags: [] });
    const { vol } = await import('memfs');
    vol.unlinkSync(filePath);

    await file.init();

    expect(file.value).toEqual({ name: 'default', tags: [] });
  });

  it('update writes nothing if the recipe changes nothing', async () => {
    const file = createFile();
    await file.init();
    const replaceFile = vi.spyOn(FileSystemService.instance, 'replaceFile');

    await file.update(() => {});

    expect(replaceFile).not.toHaveBeenCalled();
  });

  it('set replaces the content without keeping a reference to it', async () => {
    const file = createFile();
    const value: Content = { name: 'new', tags: [] };

    await file.set(value);
    value.tags.push('changed');

    expect(file.value).toEqual({ name: 'new', tags: [] });
    expect(await readJson()).toEqual({ name: 'new', tags: [], version: '2.0.0' });
  });

  it('keeps the content immutable', async () => {
    const file = createFile();
    await file.init();

    expect(Object.isFrozen(file.value)).toBe(true);
    expect(Object.isFrozen(file.value.tags)).toBe(true);
  });

  it('writes the latest content even if writes overlap', async () => {
    const file = createFile();
    await file.init();

    await Promise.all([
      file.update((content) => {
        content.name = 'first';
      }),
      file.update((content) => {
        content.name = 'second';
      }),
    ]);

    expect(await readJson()).toMatchObject({ name: 'second' });
  });

  it('reads the file after the writes queued before', async () => {
    const file = createFile();
    await file.init();
    const written = file.update((content) => {
      content.name = 'written';
    });

    const reread = createFile();
    // the read of another instance is not queued after the write, so wait for it first
    await written;
    await reread.init();

    expect(reread.value).toMatchObject({ name: 'written' });
  });

  it('a read of the same file waits for a running write', async () => {
    const file = createFile();
    await file.init();
    let finishWrite = () => {};
    const replaceFile = FileSystemService.instance.replaceFile.bind(FileSystemService.instance);
    vi.spyOn(FileSystemService.instance, 'replaceFile').mockImplementationOnce(
      (target, data) =>
        new Promise((resolve, reject) => {
          finishWrite = () => replaceFile(target, data).then(resolve, reject);
        })
    );
    const written = file.update((content) => {
      content.name = 'written';
    });

    const read = file.init();
    await Promise.resolve();
    finishWrite();
    await Promise.all([written, read]);

    expect(file.value).toMatchObject({ name: 'written' });
  });
});
