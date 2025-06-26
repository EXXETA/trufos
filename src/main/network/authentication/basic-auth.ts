import AuthStrategy from './auth-strategy';
import { BasicAuthenticationInformation } from 'shim/objects/auth';

export default class BasicAuthStrategy extends AuthStrategy<BasicAuthenticationInformation> {
  async getAuthHeader() {
    const credentials = `${this.authInfo.username}:${this.authInfo.password}`;
    const encoded = Buffer.from(credentials).toString('base64');
    return `Basic ${encoded}`;
  }
}
