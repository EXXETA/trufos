import { describe, expect, it, vi } from 'vitest';
import { safeStorage } from 'electron';
import fs from 'node:fs/promises';
import { McpAccessToken } from './access-token';

describe('McpAccessToken', () => {
  it('should create a token once and keep it', async () => {
    const token = await new McpAccessToken().get();

    // another instance reads the stored token, as after a restart of the app
    await expect(new McpAccessToken().get()).resolves.toBe(token);
    expect(token).toMatch(/^[\w-]{43}$/);
  });

  it('should give concurrent callers the same token', async () => {
    const accessToken = new McpAccessToken();

    const [a, b] = await Promise.all([accessToken.get(), accessToken.get()]);

    expect(a).toBe(b);
  });

  it('should store the token encrypted', async () => {
    const encrypt = vi.spyOn(safeStorage, 'encryptStringAsync');

    const token = await new McpAccessToken().get();

    expect(encrypt).toHaveBeenCalledWith(JSON.stringify(token));
  });

  it('should only match the current token', async () => {
    const accessToken = new McpAccessToken();
    expect(accessToken.matches('')).toBe(false);
    const old = await accessToken.get();

    const token = await accessToken.regenerate();

    expect(token).not.toBe(old);
    expect(accessToken.matches(token)).toBe(true);
    expect(accessToken.matches(old)).toBe(false);
    expect(accessToken.matches(`${token}x`)).toBe(false);
  });

  it('should replace a token that cannot be read', async () => {
    await fs.writeFile(McpAccessToken.FILE, 'garbage');

    await expect(new McpAccessToken().get()).resolves.toMatch(/^[\w-]{43}$/);
  });
});
