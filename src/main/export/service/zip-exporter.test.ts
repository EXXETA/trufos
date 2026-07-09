import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { unzipSync } from 'fflate';
import { TextWriter, Uint8ArrayReader, ZipReader } from '@zip.js/zip.js';
import { ZipExporter } from './zip-exporter';

/**
 * Creates a temporary collection directory with the given files.
 * @param files A map of relative file paths to their content.
 * @returns Path to the temporary collection directory.
 */
async function createCollection(files: Record<string, string>): Promise<string> {
  const collectionDir = await fs.mkdtemp(path.join(tmpdir(), 'export-test-'));
  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(collectionDir, filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content);
  }
  return collectionDir;
}

/**
 * Exports the given collection directory to a temporary zip and returns its unzipped entry names.
 */
async function exportAndUnzip(collectionDir: string): Promise<Record<string, Uint8Array>> {
  const targetPath = path.join(await fs.mkdtemp(path.join(tmpdir(), 'export-out-')), 'export.zip');
  await new ZipExporter().exportCollection(collectionDir, targetPath);
  const buffer = await fs.readFile(targetPath);
  return unzipSync(new Uint8Array(buffer));
}

/** Exports the given collection with a password and returns the raw encrypted archive bytes. */
async function exportEncrypted(collectionDir: string, password: string): Promise<Uint8Array> {
  const targetPath = path.join(await fs.mkdtemp(path.join(tmpdir(), 'export-out-')), 'export.zip');
  await new ZipExporter().exportCollection(collectionDir, targetPath, { password });
  return new Uint8Array(await fs.readFile(targetPath));
}

describe('ZipExporter', () => {
  it('includes collection files, excludes .gitignore matches, and always drops .git', async () => {
    const collectionDir = await createCollection({
      'collection.json': '{"id":"c1","title":"Test"}',
      'order.json': '["r1"]',
      'requests/req-a/request.json': '{"id":"r1","title":"Req A"}',
      'requests/req-a/request-body.txt': 'hello world',
      '.secrets.bin': 'ENCRYPTED',
      '.draft/request.json': '{"draft":true}',
      '.git/config': '[core]',
      '.gitignore': '.draft\n.secrets.bin',
    });

    const entries = await exportAndUnzip(collectionDir);
    const names = Object.keys(entries);

    expect(names).toContain('collection.json');
    expect(names).toContain('order.json');
    expect(names).toContain('requests/req-a/request.json');
    expect(names).toContain('.gitignore');
    expect(new TextDecoder().decode(entries['requests/req-a/request-body.txt'])).toBe(
      'hello world'
    );

    expect(names).not.toContain('.secrets.bin');
    expect(names.some((name) => name.startsWith('.draft/'))).toBe(false);
    expect(names.some((name) => name.startsWith('.git/'))).toBe(false);
  });

  it('honors glob patterns from the .gitignore at any depth', async () => {
    const collectionDir = await createCollection({
      'collection.json': '{"id":"c1","title":"Test"}',
      'debug.log': 'noise',
      'requests/req-a/trace.log': 'noise',
      'requests/req-a/request.json': '{}',
      '.gitignore': '*.log\n',
    });

    const entries = await exportAndUnzip(collectionDir);
    const names = Object.keys(entries);

    expect(names).toContain('collection.json');
    expect(names).toContain('requests/req-a/request.json');

    expect(names).not.toContain('debug.log');
    expect(names.some((name) => name.endsWith('.log'))).toBe(false);
  });

  it('encrypts the archive with AES-256 when a password is provided', async () => {
    const collectionDir = await createCollection({
      'collection.json': '{"id":"c1","title":"Test"}',
      'requests/req-a/request-body.txt': 'hello world',
    });

    const buffer = await exportEncrypted(collectionDir, 'hunter2');

    const reader = new ZipReader(new Uint8ArrayReader(buffer));
    try {
      const entries = await reader.getEntries();
      const body = entries.find((e) => e.filename === 'requests/req-a/request-body.txt');
      expect(body).toBeDefined();
      expect(body?.encrypted).toBe(true);
      expect(body?.zipCrypto).toBe(false); // AES, not legacy ZipCrypto
      if (body == null || body.directory) throw new Error('unexpected directory entry');
      const text = await body.getData(new TextWriter(), { password: 'hunter2' });
      expect(text).toBe('hello world');
    } finally {
      await reader.close();
    }
  });

  it('cannot decrypt the archive with a wrong password', async () => {
    const collectionDir = await createCollection({
      'collection.json': '{"id":"c1","title":"Test"}',
    });

    const buffer = await exportEncrypted(collectionDir, 'correct-password');

    const reader = new ZipReader(new Uint8ArrayReader(buffer));
    try {
      const entries = await reader.getEntries();
      const entry = entries.find((e) => e.filename === 'collection.json');
      if (entry == null || entry.directory) throw new Error('unexpected directory entry');
      await expect(
        entry.getData(new TextWriter(), { password: 'wrong-password' })
      ).rejects.toThrow();
    } finally {
      await reader.close();
    }
  });
});
