import { vi, describe, it, expect } from 'vitest';
import { SecretService } from './secret-service';

const ENCRYPTED_PREFIX_BUFFER = Buffer.from('encrypted:');

vi.mock('electron', () => ({
  safeStorage: {
    encryptString: vi.fn((plain: string) =>
      Buffer.concat([ENCRYPTED_PREFIX_BUFFER, Buffer.from(plain)])
    ),
    decryptString: vi.fn((buf: Buffer) =>
      buf.subarray(ENCRYPTED_PREFIX_BUFFER.byteLength).toString()
    ),
  },
}));

describe('SecretService', () => {
  const service = SecretService.instance;

  it('should encrypt a string using safeStorage', () => {
    const secret = 'mySecret';
    const result = service.encrypt(secret);
    expect(result.toString()).toBe(ENCRYPTED_PREFIX_BUFFER.toString() + secret);
  });

  it('should decrypt a string using safeStorage', () => {
    const encrypted = Buffer.concat([ENCRYPTED_PREFIX_BUFFER, Buffer.from('mySecret')]);
    const result = service.decrypt(encrypted);
    expect(result).toBe('mySecret');
  });
});
