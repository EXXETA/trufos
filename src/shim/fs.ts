export type FileInfo = {
  size: number;
  atime: Date;
  mtime: Date;
  ctime: Date;
  birthtime: Date;
  isFile: boolean;
  isDirectory: boolean;
}
