import path from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { vi, describe, expect, it } from 'vitest';
import { RequestMethod } from 'shim/objects/request-method';
import { RequestBodyType, TrufosRequest } from 'shim/objects/request';

vi.unmock('node:fs');
vi.unmock('node:fs/promises');

const VERSION = '2.4.0';

type ZipEntry = {
  name: string;
  content?: string;
  externalFileAttributes?: number;
};

async function createZip(filePath: string, entries: ZipEntry[]) {
  const fs = await import('node:fs/promises');
  const chunks: Buffer[] = [];
  const centralDirectoryChunks: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const fileName = Buffer.from(entry.name);
    const content = Buffer.from(entry.content ?? '');
    const crc = crc32(content);
    const localHeader = Buffer.alloc(30);

    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(content.length, 18);
    localHeader.writeUInt32LE(content.length, 22);
    localHeader.writeUInt16LE(fileName.length, 26);
    localHeader.writeUInt16LE(0, 28);

    const centralDirectoryHeader = Buffer.alloc(46);
    centralDirectoryHeader.writeUInt32LE(0x02014b50, 0);
    centralDirectoryHeader.writeUInt16LE(20, 4);
    centralDirectoryHeader.writeUInt16LE(20, 6);
    centralDirectoryHeader.writeUInt16LE(0, 8);
    centralDirectoryHeader.writeUInt16LE(0, 10);
    centralDirectoryHeader.writeUInt16LE(0, 12);
    centralDirectoryHeader.writeUInt16LE(0, 14);
    centralDirectoryHeader.writeUInt32LE(crc, 16);
    centralDirectoryHeader.writeUInt32LE(content.length, 20);
    centralDirectoryHeader.writeUInt32LE(content.length, 24);
    centralDirectoryHeader.writeUInt16LE(fileName.length, 28);
    centralDirectoryHeader.writeUInt16LE(0, 30);
    centralDirectoryHeader.writeUInt16LE(0, 32);
    centralDirectoryHeader.writeUInt16LE(0, 34);
    centralDirectoryHeader.writeUInt16LE(0, 36);
    centralDirectoryHeader.writeUInt32LE(entry.externalFileAttributes ?? 0, 38);
    centralDirectoryHeader.writeUInt32LE(offset, 42);

    chunks.push(localHeader, fileName, content);
    centralDirectoryChunks.push(centralDirectoryHeader, fileName);
    offset += localHeader.length + fileName.length + content.length;
  }

  const centralDirectory = Buffer.concat(centralDirectoryChunks);
  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(0, 4);
  endOfCentralDirectory.writeUInt16LE(0, 6);
  endOfCentralDirectory.writeUInt16LE(entries.length, 8);
  endOfCentralDirectory.writeUInt16LE(entries.length, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
  endOfCentralDirectory.writeUInt32LE(offset, 16);
  endOfCentralDirectory.writeUInt16LE(0, 20);

  await fs.writeFile(filePath, Buffer.concat([...chunks, centralDirectory, endOfCentralDirectory]));
}

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function collectionInfo() {
  return JSON.stringify({
    id: 'collection-id',
    version: VERSION,
    title: 'Imported Collection',
    variables: {},
    environments: {},
  });
}

function requestInfo() {
  return JSON.stringify({
    id: 'request-id',
    version: VERSION,
    title: 'Imported Request',
    url: { base: 'https://example.com', query: [] },
    method: RequestMethod.GET,
    headers: [],
    body: {
      type: RequestBodyType.TEXT,
      mimeType: 'text/plain',
    },
  });
}

describe('TrufosImporter', () => {
  it('imports a Trufos collection from a ZIP file', async () => {
    const fs = await import('node:fs/promises');
    const { TrufosImporter } = await import('./trufos-importer.js');
    const targetDirPath = path.join(tmpdir(), `trufos-import-${randomUUID()}`);
    const srcFilePath = path.join(tmpdir(), `collection-${randomUUID()}.trufos.zip`);
    await fs.mkdir(targetDirPath, { recursive: true });
    await createZip(srcFilePath, [
      { name: 'Imported Collection/' },
      { name: 'Imported Collection/collection.json', content: collectionInfo() },
      { name: 'Imported Collection/Request/request.json', content: requestInfo() },
      { name: 'Imported Collection/Request/request-body.txt', content: 'hello' },
    ]);

    const result = await new TrufosImporter().importCollection(srcFilePath, targetDirPath);

    expect(result.title).toBe('Imported Collection');
    expect(result.dirPath).toBe(path.join(targetDirPath, 'Imported Collection'));
    expect(result.children).toHaveLength(1);
    expect((result.children[0] as TrufosRequest).title).toBe('Imported Request');
    await expect(
      fs.readFile(path.join(result.dirPath, 'Request', 'request-body.txt'), 'utf8')
    ).resolves.toBe('hello');
  });

  it('does not overwrite existing collection directories', async () => {
    const fs = await import('node:fs/promises');
    const { TrufosImporter } = await import('./trufos-importer.js');
    const targetDirPath = path.join(tmpdir(), `trufos-import-conflict-${randomUUID()}`);
    const srcFilePath = path.join(tmpdir(), `collection-${randomUUID()}.trufos.zip`);
    await fs.mkdir(path.join(targetDirPath, 'Imported Collection'), { recursive: true });
    await createZip(srcFilePath, [
      { name: 'Imported Collection/' },
      { name: 'Imported Collection/collection.json', content: collectionInfo() },
    ]);

    await expect(new TrufosImporter().importCollection(srcFilePath, targetDirPath)).rejects.toThrow(
      'Collection directory already exists'
    );
    await expect(fs.readdir(targetDirPath)).resolves.toEqual(['Imported Collection']);
  });

  it('rejects unsafe ZIP entry paths', async () => {
    const fs = await import('node:fs/promises');
    const { TrufosImporter } = await import('./trufos-importer.js');
    const targetDirPath = path.join(tmpdir(), `trufos-import-unsafe-${randomUUID()}`);
    const srcFilePath = path.join(tmpdir(), `collection-${randomUUID()}.trufos.zip`);
    await fs.mkdir(targetDirPath, { recursive: true });
    await createZip(srcFilePath, [{ name: '../evil.txt', content: 'evil' }]);

    await expect(
      new TrufosImporter().importCollection(srcFilePath, targetDirPath)
    ).rejects.toThrow();
    await expect(fs.readdir(targetDirPath)).resolves.toEqual([]);
  });

  it('rejects symlink ZIP entries', async () => {
    const fs = await import('node:fs/promises');
    const { TrufosImporter } = await import('./trufos-importer.js');
    const targetDirPath = path.join(tmpdir(), `trufos-import-symlink-${randomUUID()}`);
    const srcFilePath = path.join(tmpdir(), `collection-${randomUUID()}.trufos.zip`);
    await fs.mkdir(targetDirPath, { recursive: true });
    await createZip(srcFilePath, [
      { name: 'Imported Collection/' },
      { name: 'Imported Collection/collection.json', content: collectionInfo() },
      {
        name: 'Imported Collection/link',
        content: 'request.json',
        externalFileAttributes: (0o120000 << 16) >>> 0,
      },
    ]);

    await expect(new TrufosImporter().importCollection(srcFilePath, targetDirPath)).rejects.toThrow(
      'Refusing to import symlink'
    );
    await expect(fs.readdir(targetDirPath)).resolves.toEqual([]);
  });

  it('rejects ZIP files without exactly one collection root', async () => {
    const fs = await import('node:fs/promises');
    const { TrufosImporter } = await import('./trufos-importer.js');
    const targetDirPath = path.join(tmpdir(), `trufos-import-roots-${randomUUID()}`);
    const srcFilePath = path.join(tmpdir(), `collection-${randomUUID()}.trufos.zip`);
    await fs.mkdir(targetDirPath, { recursive: true });
    await createZip(srcFilePath, [
      { name: 'One/' },
      { name: 'One/collection.json', content: collectionInfo() },
      { name: 'Two/' },
      { name: 'Two/collection.json', content: collectionInfo() },
    ]);

    await expect(new TrufosImporter().importCollection(srcFilePath, targetDirPath)).rejects.toThrow(
      'exactly one collection directory'
    );
  });

  it('rejects ZIP files without collection.json in the collection root', async () => {
    const fs = await import('node:fs/promises');
    const { TrufosImporter } = await import('./trufos-importer.js');
    const targetDirPath = path.join(tmpdir(), `trufos-import-missing-info-${randomUUID()}`);
    const srcFilePath = path.join(tmpdir(), `collection-${randomUUID()}.trufos.zip`);
    await fs.mkdir(targetDirPath, { recursive: true });
    await createZip(srcFilePath, [{ name: 'Imported Collection/' }]);

    await expect(new TrufosImporter().importCollection(srcFilePath, targetDirPath)).rejects.toThrow(
      'collection.json'
    );
  });
});
