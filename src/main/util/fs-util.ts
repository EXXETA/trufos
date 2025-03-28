import fs from 'node:fs/promises';
import { app } from 'electron';

export const USER_DATA_DIR = app.getPath('userData');

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
