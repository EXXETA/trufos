export type FileInfo = {
  size: number;
  atime: Date;
  mtime: Date;
  ctime: Date;
  birthtime: Date;
  isFile: boolean;
  isDirectory: boolean;
};

/**
 * Sanitize a title by removing invalid characters and formatting it. The resulting string may be used as file or directory name
 * @param title the title to sanitize
 * @returns the sanitized title
 */
export function sanitizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}
