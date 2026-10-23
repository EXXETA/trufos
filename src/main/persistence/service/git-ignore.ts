import path from 'node:path';
import fs from 'node:fs/promises';
import { exists } from 'main/util/fs-util';

export const GIT_IGNORE_FILE_NAME = '.gitignore';

/**
 * Creates a collection .gitignore file in the specified directory path.
 * @param dirPath the directory path where the .gitignore file should be created
 * @param lines the lines of the file
 */
export async function createGitIgnore(dirPath: string, lines: readonly string[]) {
  const filePath = path.join(dirPath, GIT_IGNORE_FILE_NAME);
  logger.info(`Creating .gitignore file at`, filePath);
  await fs.writeFile(filePath, lines.join('\n'));
}

/**
 * Makes sure the .gitignore file of a collection has the given lines: a missing file is created,
 * missing lines are appended. Lines are only ever added, so the user's own lines stay as they are.
 * @param dirPath the directory path of the collection
 * @param lines the lines the file must have
 */
export async function ensureGitIgnore(dirPath: string, lines: readonly string[]) {
  const filePath = path.join(dirPath, GIT_IGNORE_FILE_NAME);
  if (!(await exists(filePath))) return await createGitIgnore(dirPath, lines);

  const content = await fs.readFile(filePath, 'utf8');
  const existing = new Set(content.split(/\r?\n/).map((line) => line.trim()));
  const missing = lines.filter((line) => !existing.has(line));
  if (missing.length === 0) return;

  logger.info(`Adding ${missing.join(', ')} to .gitignore file at`, filePath);
  const separator = content === '' || content.endsWith('\n') ? '' : '\n';
  await fs.appendFile(filePath, `${separator}${missing.join('\n')}`);
}

/**
 * Creates a check whether a path is ignored by `.gitignore` lines. Only the patterns Trufos writes
 * itself are supported: names without a slash, which match a file or directory of that name at any
 * depth, with `*` matching any characters of a name.
 * @param lines the lines of the `.gitignore` file
 * @returns a check that takes a path relative to the directory of the `.gitignore` file
 */
export function createGitIgnoreMatcher(
  lines: readonly string[]
): (relativePath: string) => boolean {
  // the path is split into names, so a wildcard cannot match across a slash
  const patterns = lines.map(
    (line) => new RegExp(`^${line.split('*').map(RegExp.escape).join('.*')}$`)
  );
  return (relativePath) =>
    relativePath.split(/[\\/]/).some((name) => patterns.some((pattern) => pattern.test(name)));
}
