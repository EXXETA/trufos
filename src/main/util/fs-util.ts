import type { ReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import { isErrnoException } from 'shim/error/errno';

export const USER_DATA_DIR = app.getPath('userData');

/**
 * The number of files that may still be read concurrently by {@link readFileLimited}. Counts down
 * as reads take a slot and back up as they return it.
 */
let availableFileReads = 10;

/** The reads waiting for a slot, in the order they asked for one. */
const waitingReads: (() => void)[] = [];

/**
 * Reads a file, but waits for a free slot while {@link availableFileReads} is exhausted.
 *
 * `fs.readFile()` opens, reads and closes the file in three separate steps and keeps the file
 * descriptor open in between. Reading a whole collection at once would therefore pile up one
 * descriptor per pending read and exhaust the process limit (EMFILE) on large collections. This
 * does not make reading slower: libuv already executes file system work on a small thread pool,
 * so the limit only caps the descriptors held in the meantime.
 *
 * @param filePath the path to the file to read
 * @param encoding OPTIONAL: the encoding to decode the file with. If omitted, the raw bytes are
 *   returned.
 */
export function readFileLimited(filePath: string, encoding: BufferEncoding): Promise<string>;
export function readFileLimited(filePath: string): Promise<NonSharedBuffer>;
export async function readFileLimited(filePath: string, encoding?: BufferEncoding) {
  if (availableFileReads > 0) {
    availableFileReads--;
  } else {
    await new Promise<void>((resolve) => waitingReads.push(resolve));
  }

  try {
    return await fs.readFile(filePath, encoding ?? null);
  } finally {
    // hand the slot over to the next waiting read instead of returning and re-taking it, so that
    // a read started in the meantime cannot slip past the limit
    const next = waitingReads.shift();
    if (next != null) {
      next();
    } else {
      availableFileReads++;
    }
  }
}

/**
 * Check if a file or directory exists
 * @param filePath the path to the file or directory
 */
export async function exists(filePath: string) {
  try {
    await fs.access(filePath);
  } catch {
    return false;
  }
  return true;
}

/**
 * Check if a directory is empty (ignoring .DS_Store files)
 * @param dirPath the path to the directory
 * @returns true if the directory is empty, false otherwise
 */
export async function isEmpty(dirPath: string) {
  return !(await fs.readdir(dirPath)).some((file) => file !== '.DS_Store');
}

/**
 * Opens a file for reading. The file is open when this resolves, so renaming, replacing or deleting
 * it afterwards does not affect the stream.
 * @param filePath the path of the file
 * @param encoding OPTIONAL: the encoding to decode the file with. If omitted, raw bytes are streamed.
 * @param range OPTIONAL: the offsets of the first and the last byte to read, both inclusive
 * @returns the stream, or undefined if the file does not exist
 */
export async function openFile(
  filePath: string,
  encoding?: BufferEncoding,
  range: { start?: number; end?: number } = {}
): Promise<ReadStream | undefined> {
  try {
    const handle = await fs.open(filePath, 'r');
    return handle.createReadStream({ encoding, ...range });
  } catch (error) {
    if (isErrnoException(error) && error.code === 'ENOENT') return undefined;
    throw error;
  }
}

/** Returns true if `dirPath` is `parentDirPath` itself or a directory inside it. */
export function isSameOrInside(dirPath: string, parentDirPath: string): boolean {
  return dirPath === parentDirPath || dirPath.startsWith(parentDirPath + path.sep);
}

/**
 * Resolves the symbolic links of a path. A path that does not exist (yet) is resolved through its
 * closest existing ancestor, so a file that is about to be created is judged by where it will be.
 * @param filePath an absolute path
 * @returns the real path
 */
async function realPathOfExisting(filePath: string): Promise<string> {
  try {
    return await fs.realpath(filePath);
  } catch (error) {
    if (!isErrnoException(error) || error.code !== 'ENOENT') throw error;
    const parent = path.dirname(filePath);
    if (parent === filePath) return filePath; // the root does not exist, e.g. an unknown drive
    return path.join(await realPathOfExisting(parent), path.basename(filePath));
  }
}

/**
 * Checks if a file is inside a directory, after following symbolic links. Unlike
 * {@link isSameOrInside}, this cannot be fooled by `..` segments or by a link inside the directory
 * that points outside of it.
 * @param filePath the path of the file
 * @param dirPath the path of the directory
 * @returns true if the file is inside the directory or one of its subdirectories
 */
export async function isInsideDirectory(filePath: string, dirPath: string): Promise<boolean> {
  const [realFilePath, realDirPath] = await Promise.all([
    realPathOfExisting(path.resolve(filePath)),
    realPathOfExisting(path.resolve(dirPath)),
  ]);
  const relative = path.relative(realDirPath, realFilePath);
  return (
    relative !== '' &&
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}
