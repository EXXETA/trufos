import path from 'path';
import { migrateInfoFile } from './migrators';
import { describe, it, expect } from 'vitest';
import { tmpdir } from 'node:os';
import fs from 'node:fs/promises';
import { VERSION } from './latest';

describe(`${migrateInfoFile.name}()`, () => {
  it('should migrate the given info file to the latest schema', async () => {
    // Arrange
    const infoFile = {
      version: '1.0.0' as const,
      title: 'Test Request',
      url: 'https://example.com',
      method: 'GET',
      headers: [{ key: 'key', value: 'value', isActive: true }],
      body: {
        type: 'text',
        mimeType: 'text/plain',
      },
    };
    const infoFilePath = path.join(tmpdir(), 'request.json');
    await fs.writeFile(infoFilePath, JSON.stringify(infoFile, null, 2));

    // Act
    const result = await migrateInfoFile(infoFile, 'request', infoFilePath);

    // Assert
    expect(result).toEqual({
      id: expect.any(String),
      title: infoFile.title,
      url: infoFile.url,
      method: infoFile.method,
      headers: infoFile.headers,
      body: infoFile.body,
      version: VERSION.string,
    });
  });
});
