import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { FileSystemService } from './filesystem-service';

const service = FileSystemService.instance;

describe('FileSystemService', () => {
  it('should keep all temporary files of the session in one directory', () => {
    const first = service.temporaryFile();
    const second = service.temporaryFile();

    const directory = service.temporaryDirectory;
    expect(path.dirname(directory)).toBe(tmpdir());
    expect(path.basename(directory)).toMatch(/^trufos-/);
    expect(path.dirname(first.name)).toBe(directory);
    expect(path.dirname(second.name)).toBe(directory);
    expect(first.name).not.toBe(second.name);
  });

  it('should create temporary files that only the current user can access', () => {
    const file = service.temporaryFile();

    expect(fs.statSync(file.name).mode & 0o777).toBe(0o600);
  });

  it('should delete all temporary files of the session', () => {
    const file = service.temporaryFile();
    fs.closeSync(file.fd);
    const directory = service.temporaryDirectory;

    service.deleteTemporaryFiles();

    expect(fs.existsSync(directory)).toBe(false);
    expect(path.dirname(service.temporaryFile().name)).not.toBe(directory);
  });

  describe('replaceFile()', () => {
    const dir = path.join(tmpdir(), 'replace-file');
    const target = path.join(dir, 'request.json');

    it('replaces the content of a file without leaving a temporary file behind', async () => {
      // Arrange
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(target, 'old');

      // Act
      await service.replaceFile(target, 'new');

      // Assert
      expect(await fs.promises.readFile(target, 'utf8')).toBe('new');
      expect(await fs.promises.readdir(dir)).toEqual(['request.json']);
    });

    it('deletes the temporary file and keeps the old content if the write fails', async () => {
      // Act & Assert
      await expect(
        service.replaceFile(path.join(dir, 'missing', 'file.json'), 'new')
      ).rejects.toThrow();
      expect(fs.existsSync(path.join(dir, 'missing'))).toBe(false);
    });

    it('recognizes its temporary files', () => {
      const name = `.request.json.${randomUUID()}.tmp`;

      expect(service.isReplacementFile(name)).toBe(true);
      expect(service.isReplacementFile('request.json')).toBe(false);
      expect(service.isReplacementFile(`.request.json.not-a-uuid.tmp`)).toBe(false);
    });
  });
});
