import path from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { vol } from 'memfs';

export function fileSync() {
  const name = path.join(tmpdir(), randomUUID());
  const fd = vol.openSync(name, 'w+');
  const removeCallback = () => vol.unlinkSync(name);
  return { name, fd, removeCallback };
}

export default {
  fileSync,
};
