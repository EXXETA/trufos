import AuthStrategy from './auth-strategy';
import { BasicAuthorizationInformation } from 'shim/objects/auth';

export default class BasicAuthStrategy extends AuthStrategy<BasicAuthorizationInformation> {
  async getAuthHeader() {
    const credentials = `${this.authInfo.username}:${this.authInfo.password}`;
    const encoded = Buffer.from(credentials).toString('base64');
    return `Basic ${encoded}`;
  }
}
