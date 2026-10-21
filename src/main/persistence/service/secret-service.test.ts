import { safeStorage } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { SecretService } from './secret-service';

/** The encrypted bytes are the plain text prefixed with the version of the key it used. */
let currentKey = 1;

// A dynamic import resolves as ESM, which needs the full path to the shared mock's index file.
vi.mock('electron', async () => ({
  ...(await import('main/__mocks__/electron/index.js')),
  safeStorage: {
    encryptStringAsync: vi.fn(),
    decryptStringAsync: vi.fn(async (encrypted: Buffer) => {
      const [, key, plain] = /^key(\d+):(.*)$/s.exec(encrypted.toString())!;
      return { result: plain, shouldReEncrypt: Number(key) !== currentKey };
    }),
  },
}));

describe('SecretService', () => {
  const service = SecretService.instance;

  beforeEach(() => {
    currentKey = 1;
    vi.mocked(safeStorage.encryptStringAsync).mockImplementation(async (plain) =>
      Buffer.from(`key${currentKey}:${plain}`)
    );
  });

  it('should encrypt a string using safeStorage', async () => {
    const result = await service.encrypt('mySecret');
    expect(result.toString()).toBe('key1:mySecret');
  });

  it('should decrypt a string using safeStorage', async () => {
    const result = await service.decrypt(Buffer.from('key1:mySecret'));
    expect(result).toEqual({ plain: 'mySecret', reEncrypted: undefined });
    expect(safeStorage.decryptStringAsync).toHaveBeenCalledTimes(1);
    expect(safeStorage.encryptStringAsync).not.toHaveBeenCalled();
  });

  it('should re-encrypt a secret that uses an outdated key', async () => {
    currentKey = 2;

    const result = await service.decrypt(Buffer.from('key1:mySecret'));

    expect(result.plain).toBe('mySecret');
    expect(result.reEncrypted?.toString()).toBe('key2:mySecret');
  });

  it('should write a value as encrypted JSON', async () => {
    const filePath = path.join(tmpdir(), 'secrets.bin');

    await service.writeJson(filePath, { token: 'mySecret' });

    expect(await readFile(filePath, 'utf8')).toBe('key1:{"token":"mySecret"}');
  });

  it('should read encrypted JSON and parse it with the schema', async () => {
    const filePath = path.join(tmpdir(), 'secrets.bin');
    await writeFile(filePath, 'key1:{"token":"mySecret"}');

    const result = await service.readJson(filePath, z.object({ token: z.string() }));

    expect(result).toEqual({ token: 'mySecret' });
  });

  it('should reject encrypted JSON that does not match the schema', async () => {
    const filePath = path.join(tmpdir(), 'secrets.bin');
    await writeFile(filePath, 'key1:{"token":1}');

    await expect(service.readJson(filePath, z.object({ token: z.string() }))).rejects.toThrow();
  });

  it('should write the file again if it uses an outdated key', async () => {
    const filePath = path.join(tmpdir(), 'secrets.bin');
    await writeFile(filePath, 'key1:{"token":"mySecret"}');
    currentKey = 2;

    const result = await service.readJson(filePath, z.object({ token: z.string() }));

    expect(result).toEqual({ token: 'mySecret' });
    expect(await readFile(filePath, 'utf8')).toBe('key2:{"token":"mySecret"}');
  });

  it('should not write the file if it uses the current key', async () => {
    const filePath = path.join(tmpdir(), 'secrets.bin');
    await writeFile(filePath, 'key1:{"token":"mySecret"}');

    await service.readJson(filePath, z.object({ token: z.string() }));

    expect(safeStorage.encryptStringAsync).not.toHaveBeenCalled();
  });
});
