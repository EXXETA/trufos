/**
 * Type declarations for @usebruno/lang - the official Bruno collection parser.
 * @see https://www.npmjs.com/package/@usebruno/lang
 */
declare module '@usebruno/lang' {
  export interface BrunoMeta {
    name: string;
    seq?: string;
    type?: string;
  }

  export interface BrunoHttp {
    method: string;
    url: string;
    body?: string;
    auth?: string;
  }

  export interface BrunoHeader {
    name: string;
    value: string;
    enabled: boolean;
  }

  export interface BrunoFormField {
    name: string;
    value: string;
    enabled: boolean;
    type: 'text' | 'file';
    contentType?: string;
  }

  export interface BrunoBody {
    json?: string;
    text?: string;
    xml?: string;
    formUrlEncoded?: BrunoFormField[];
    multipartForm?: BrunoFormField[];
  }

  export interface BrunoOAuth2 {
    grantType: 'client_credentials' | 'authorization_code' | string;
    accessTokenUrl?: string;
    clientId?: string;
    clientSecret?: string;
    scope?: string;
    credentialsPlacement?: string;
    callbackUrl?: string;
    authorizationUrl?: string;
    pkce?: boolean;
  }

  export interface BrunoAuth {
    bearer?: { token: string };
    basic?: { username: string; password: string };
    oauth2?: BrunoOAuth2;
  }

  export interface BrunoRequest {
    meta: BrunoMeta;
    http: BrunoHttp;
    headers?: BrunoHeader[];
    body?: BrunoBody;
    auth?: BrunoAuth;
  }

  export interface BrunoCollectionMeta {
    name: string;
    type?: string;
  }

  export interface BrunoCollectionFile {
    meta: BrunoCollectionMeta;
  }

  export function bruToJsonV2(content: string): BrunoRequest;
  export function collectionBruToJson(content: string): BrunoCollectionFile;
}
