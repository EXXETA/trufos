import { OAuth2AuthorizationInformation } from 'shim/objects/auth/oauth2';
import AuthStrategy from '../auth-strategy';

export default abstract class OAuth2AuthStrategy<
  T extends OAuth2AuthorizationInformation,
> extends AuthStrategy<T> {
  public async getAuthHeader() {
    return `Bearer ${this.authInfo.tokens.access_token}`;
  }

  protected abstract getToken(): Promise<void>;
}
