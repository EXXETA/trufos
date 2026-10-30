import { randomBytes, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { z } from 'zod';
import { exists, USER_DATA_DIR } from 'main/util/fs-util';
import { SecretService } from 'main/persistence/service/secret-service';

const secretService = SecretService.instance;

/**
 * The access token of the MCP server. Clients send it as `Authorization: Bearer <token>`. It is
 * stored encrypted in the user data directory, not in the settings, as it grants access to the
 * collections and their secrets.
 */
export class McpAccessToken {
  public static readonly FILE = path.join(USER_DATA_DIR, 'mcp-token.bin');

  public static readonly instance = new McpAccessToken();

  private token?: string;

  /** Settles once the token was read or created, so concurrent callers get the same token. */
  private loading?: Promise<string>;

  /**
   * Returns the token, reading it or creating it if there is none yet. A token that cannot be read
   * is replaced, so clients have to be configured again.
   */
  public get(): Promise<string> {
    if (this.token != null) return Promise.resolve(this.token);
    this.loading ??= this.load().finally(() => (this.loading = undefined));
    return this.loading;
  }

  private async load(): Promise<string> {
    if (await exists(McpAccessToken.FILE)) {
      try {
        this.token = await secretService.readJson(McpAccessToken.FILE, z.string().min(1));
        return this.token;
      } catch (error) {
        logger.warn(
          'Could not read the access token of the MCP server, creating a new one:',
          error
        );
      }
    }
    return await this.regenerate();
  }

  /** Replaces the token. Requests with the old one are rejected from now on. */
  public async regenerate(): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await secretService.writeJson(McpAccessToken.FILE, token);
    this.token = token;
    logger.info('Created a new access token for the MCP server');
    return token;
  }

  /**
   * @param candidate the token a client sent
   * @returns whether it is the token, compared in constant time. False until the token was read
   * with {@link get}.
   */
  public matches(candidate: string): boolean {
    if (this.token == null) return false;
    const expected = Buffer.from(this.token);
    const actual = Buffer.from(candidate);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
}
