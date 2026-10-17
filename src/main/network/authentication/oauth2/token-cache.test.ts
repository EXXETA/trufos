import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TokenEndpointResponse } from 'openid-client';
import { OAuth2TokenCache, type TokenSource } from './token-cache';

const KEY = ['config'];

function tokens(
  accessToken: string,
  extra: Partial<TokenEndpointResponse> = {}
): TokenEndpointResponse {
  return { access_token: accessToken, token_type: 'bearer', ...extra };
}

describe('OAuth2TokenCache', () => {
  let now: number;
  let cache: OAuth2TokenCache;
  let source: {
    acquire: ReturnType<typeof vi.fn<TokenSource['acquire']>>;
    refresh: ReturnType<typeof vi.fn<TokenSource['refresh']>>;
  };

  beforeEach(() => {
    now = 1_000_000;
    cache = new OAuth2TokenCache(() => now);
    source = { acquire: vi.fn<TokenSource['acquire']>(), refresh: vi.fn<TokenSource['refresh']>() };
  });

  const get = () => cache.get([...KEY], source);

  it('reuses tokens until they expire', async () => {
    source.acquire.mockResolvedValueOnce(tokens('first', { expires_in: 300 }));

    await get();
    now += 200_000;
    const result = await get();

    expect(result.access_token).toBe('first');
    expect(source.acquire).toHaveBeenCalledOnce();
  });

  it('acquires new tokens shortly before they expire', async () => {
    source.acquire
      .mockResolvedValueOnce(tokens('first', { expires_in: 300 }))
      .mockResolvedValueOnce(tokens('second', { expires_in: 300 }));

    await get();
    now += 290_000;
    const result = await get();

    expect(result.access_token).toBe('second');
    expect(source.refresh).not.toHaveBeenCalled();
  });

  it('keeps tokens without an expiry for the session', async () => {
    source.acquire.mockResolvedValueOnce(tokens('forever'));

    await get();
    now += 24 * 60 * 60 * 1000;
    const result = await get();

    expect(result.access_token).toBe('forever');
    expect(source.acquire).toHaveBeenCalledOnce();
  });

  it('refreshes expired tokens with their refresh token', async () => {
    source.acquire.mockResolvedValueOnce(
      tokens('first', { expires_in: 60, refresh_token: 'refresh' })
    );
    source.refresh.mockResolvedValueOnce(tokens('refreshed', { expires_in: 60 }));

    await get();
    now += 60_000;
    const result = await get();

    expect(result.access_token).toBe('refreshed');
    expect(source.refresh).toHaveBeenCalledExactlyOnceWith('refresh');
    expect(source.acquire).toHaveBeenCalledOnce();
  });

  it('acquires new tokens if refreshing failed', async () => {
    source.acquire
      .mockResolvedValueOnce(tokens('first', { expires_in: 60, refresh_token: 'refresh' }))
      .mockResolvedValueOnce(tokens('second'));
    source.refresh.mockRejectedValueOnce(new Error('invalid_grant'));

    await get();
    now += 60_000;
    const result = await get();

    expect(result.access_token).toBe('second');
  });
});
