import { tmpdir } from 'node:os';

export function getPath() {
  return tmpdir();
}

export function getName() {
  return 'Trufos';
}

export const isPackaged = false;
