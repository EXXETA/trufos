import AuthStrategy from './auth-strategy';
import { BearerAuthorizationInformation } from 'shim/objects';

export default class BearerAuthStrategy extends AuthStrategy<BearerAuthorizationInformation> {
  async getAuthHeader() {
    return `Bearer ${this.authInfo.token}`;
  }
}
