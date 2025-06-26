import AuthStrategy from './auth-strategy';
import { BearerAuthenticationInformation } from 'shim/objects/auth';

export default class BearerAuthStrategy extends AuthStrategy<BearerAuthenticationInformation> {
  async getAuthHeader() {
    return `Bearer ${this.authInfo.token}`;
  }
}
