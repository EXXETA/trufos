import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
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
});
