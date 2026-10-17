import type { TokenEndpointResponse } from 'openid-client';
import { Cache, type CacheKey } from 'main/util/cache';

/** Tokens are renewed this long before they expire, so they do not expire while a request is sent. */
const EXPIRY_MARGIN_MS = 30_000;

/** How tokens are obtained for a configuration. */
export interface TokenSource {
  /** Acquires new tokens, e.g. by a client credentials grant or a browser login. */
  acquire(): Promise<TokenEndpointResponse>;
  /** Exchanges a refresh token for new tokens. */
  refresh(refreshToken: string): Promise<TokenEndpointResponse>;
}

interface CachedTokens {
  tokens: TokenEndpointResponse;
  /** When the access token expires, or undefined if the server did not say. */
  expiresAt?: number;
}

/**
 * Keeps the OAuth 2.0 tokens of this session in memory, so they are not acquired for every request.
 * An auth code flow would otherwise open the browser every time. Tokens are never written to disk.
 */
export class OAuth2TokenCache {
  public static readonly instance = new OAuth2TokenCache();

  private readonly cache = new Cache<CachedTokens>({
    isValid: (cached) => !this.isExpired(cached),
  });

  constructor(private readonly now: () => number = Date.now) {}

  /**
   * Returns valid tokens for a configuration. They are reused until they are about to expire, then
   * refreshed if there is a refresh token, or acquired again otherwise. Tokens without an expiry are
   * kept for the session.
   * @param key the settings of the configuration the tokens depend on. Keys are compared by value.
   * @param source obtains new tokens for the configuration
   */
  public async get(key: CacheKey, source: TokenSource): Promise<TokenEndpointResponse> {
    const cached = await this.cache.get(key, (expired) =>
      this.renew(source, expired?.tokens.refresh_token)
    );
    return cached.tokens;
  }

  /** Forgets all tokens. */
  public clear(): void {
    this.cache.clear();
  }

  private async renew(source: TokenSource, refreshToken?: string): Promise<CachedTokens> {
    let tokens: TokenEndpointResponse | undefined;
    if (refreshToken != null) {
      tokens = await source.refresh(refreshToken).catch((error: unknown) => {
        // only the name, as the error can contain the response of the token endpoint
        const name = error instanceof Error ? error.name : typeof error;
        logger.info(`Refreshing the OAuth 2.0 tokens failed with ${name}, acquiring new ones`);
        return undefined;
      });
    }
    tokens ??= await source.acquire();
    const expiresAt = tokens.expires_in != null ? this.now() + tokens.expires_in * 1000 : undefined;
    return { tokens, expiresAt };
  }

  private isExpired({ expiresAt }: CachedTokens): boolean {
    return expiresAt != null && this.now() >= expiresAt - EXPIRY_MARGIN_MS;
  }
}
