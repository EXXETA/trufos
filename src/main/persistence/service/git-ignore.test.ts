import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { GIT_IGNORE_FILE_NAME, ensureGitIgnore } from './git-ignore';

const LINES = ['.draft', '.secrets.bin', '.*.tmp'];

describe('ensureGitIgnore()', () => {
  let dirPath: string;

  const gitIgnorePath = () => path.join(dirPath, GIT_IGNORE_FILE_NAME);
  const readGitIgnore = () => fs.readFile(gitIgnorePath(), 'utf8');

  beforeEach(async () => {
    dirPath = await fs.mkdtemp(path.join(os.tmpdir(), 'trufos-gitignore-'));
  });

  afterEach(async () => {
    await fs.rm(dirPath, { recursive: true, force: true });
  });

  it('creates a missing .gitignore', async () => {
    // Act
    await ensureGitIgnore(dirPath, LINES);

    // Assert
    expect(await readGitIgnore()).toBe(LINES.join('\n'));
  });

  it('appends the missing lines only once and keeps all others', async () => {
    // Arrange
    await fs.writeFile(gitIgnorePath(), 'node_modules\n.draft\n.secrets.bin');

    // Act
    await ensureGitIgnore(dirPath, LINES);
    await ensureGitIgnore(dirPath, LINES);

    // Assert
    expect(await readGitIgnore()).toBe('node_modules\n.draft\n.secrets.bin\n.*.tmp');
  });

  it('does not change a .gitignore that has all lines', async () => {
    // Arrange
    const content = `${LINES.join('\n')}\nnode_modules\n`;
    await fs.writeFile(gitIgnorePath(), content);

    // Act
    await ensureGitIgnore(dirPath, LINES);

    // Assert
    expect(await readGitIgnore()).toBe(content);
  });
});
