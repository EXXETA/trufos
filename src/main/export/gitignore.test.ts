import { describe, expect, it } from 'vitest';
import { Gitignore } from './gitignore';

describe('Gitignore', () => {
  it('matches bare names against the basename at any depth', () => {
    const gitignore = new Gitignore('.secrets.bin\n.draft');
    expect(gitignore.ignores('.secrets.bin')).toBe(true);
    expect(gitignore.ignores('requests/req-a/.secrets.bin')).toBe(true);
    expect(gitignore.ignores('.draft')).toBe(true);
    expect(gitignore.ignores('collection.json')).toBe(false);
  });

  it('ignores comments and blank lines', () => {
    const gitignore = new Gitignore('# a comment\n\n  \n*.log');
    expect(gitignore.ignores('debug.log')).toBe(true);
    expect(gitignore.ignores('a comment')).toBe(false);
  });

  it('matches glob patterns at any depth', () => {
    const gitignore = new Gitignore('*.log');
    expect(gitignore.ignores('debug.log')).toBe(true);
    expect(gitignore.ignores('logs/error.log')).toBe(true);
    expect(gitignore.ignores('collection.json')).toBe(false);
  });
});
