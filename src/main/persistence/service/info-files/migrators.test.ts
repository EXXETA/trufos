import { migrateInfoFile } from './migrators';
import { describe, it, expect } from 'vitest';

describe(`${migrateInfoFile.name}()`, () => {
  it('should migrate the given info file to the latest schema and remove the version property', async () => {
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

    // Act
    const result = await migrateInfoFile(infoFile);

    // Assert
    expect(result).toEqual({
      id: expect.any(String),
      title: infoFile.title,
      url: infoFile.url,
      method: infoFile.method,
      headers: infoFile.headers,
      body: infoFile.body,
    });
  });
});
