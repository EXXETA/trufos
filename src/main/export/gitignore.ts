import { minimatch } from 'minimatch';

/**
 * A minimal `.gitignore` matcher used to decide which files end up in a collection export, mirroring
 * how `git archive` omits ignored paths. Each non-comment line is treated as a glob pattern. Using
 * `matchBase`, a pattern without a slash matches the basename at any depth (so `.secrets.bin` also
 * excludes nested request secrets), and `dot` lets patterns match dotfiles. Only a single root
 * `.gitignore` is considered (collections do not nest them).
 */
export class Gitignore {
  private readonly patterns: string[];

  constructor(content: string) {
    this.patterns = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== '' && !line.startsWith('#'));
  }

  /** Returns whether the given POSIX-style relative path is excluded. */
  public ignores(relativePath: string): boolean {
    return this.patterns.some((pattern) =>
      minimatch(relativePath, pattern, { dot: true, matchBase: true })
    );
  }
}
