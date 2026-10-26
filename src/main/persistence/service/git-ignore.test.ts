import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { GIT_IGNORE_FILE_NAME, createGitIgnoreMatcher, ensureGitIgnore } from './git-ignore';
import { GIT_IGNORE_LINES } from './info-files/latest';

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

describe('createGitIgnoreMatcher()', () => {
  const isIgnored = createGitIgnoreMatcher(LINES);

  it.each([
    ['.draft'],
    [path.join('folder', 'request', '.draft', 'request.json')],
    ['.secrets.bin'],
    [path.join('request', '.secrets.bin')],
    [path.join('request', '.request.json.0b5c4a2e-1f3d-4e5a-9b6c-7d8e9f0a1b2c.tmp')],
  ])('ignores %s', (relativePath) => {
    expect(isIgnored(relativePath)).toBe(true);
  });

  it.each([
    ['collection.json'],
    [path.join('request', 'request.json')],
    [path.join('request', 'request-body.txt')],
    [path.join('drafts', 'request.json')],
    [path.join('request', 'request.tmp')],
  ])('does not ignore %s', (relativePath) => {
    expect(isIgnored(relativePath)).toBe(false);
  });

  it('takes the dot of a pattern literally', () => {
    expect(createGitIgnoreMatcher(['.secrets.bin'])('xsecrets.bin')).toBe(false);
  });

  it('supports every line Trufos writes into a collection', () => {
    // a slash, a negation or a character class would need a real .gitignore matcher
    for (const line of GIT_IGNORE_LINES) expect(line).toMatch(/^[^/!?[\]\\]+$/);
  });
});
