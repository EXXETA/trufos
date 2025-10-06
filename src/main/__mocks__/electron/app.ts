import { tmpdir } from 'node:os';

export function getPath() {
  return tmpdir();
}

export function getName() {
  return 'Trufos';
}

export function getVersion() {
  return '0.0.0';
}

export const isPackaged = false;
