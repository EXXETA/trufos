import {
  AuthorizationType,
  OAuth1Method,
  OAuth1SignatureMethod,
  OAuth2ClientAuthenticationMethod,
  OAuth2Method,
  OAuth2PKCECodeChallengeMethod,
} from 'shim/objects';
import { type FormComponentConfiguration } from './ModularForm';

export const AUTHORIZATION_NONE = 'none' as const;
export type AuthorizationTypeOrNone = AuthorizationType | typeof AUTHORIZATION_NONE;

/** What an authorization belongs to. Folders cannot opt out, collections have nothing to inherit. */
export type AuthorizationLevel = 'request' | 'folder' | 'collection';

const CONCRETE_TYPES = [
  AuthorizationType.BEARER,
  AuthorizationType.BASIC,
  AuthorizationType.OAUTH2,
  AuthorizationType.OAUTH1,
];

const TYPES: { [L in AuthorizationLevel]: AuthorizationTypeOrNone[] } = {
  request: [AUTHORIZATION_NONE, AuthorizationType.INHERIT, ...CONCRETE_TYPES],
  folder: [AuthorizationType.INHERIT, ...CONCRETE_TYPES],
  collection: [AUTHORIZATION_NONE, ...CONCRETE_TYPES],
};

export const AUTHORIZATION_TYPE_LABELS: { [K in AuthorizationTypeOrNone]: string } = {
  [AUTHORIZATION_NONE]: 'None',
  [AuthorizationType.INHERIT]: 'Inherit from parent',
  [AuthorizationType.BEARER]: 'Bearer Token',
  [AuthorizationType.BASIC]: 'Basic Auth',
  [AuthorizationType.OAUTH2]: 'OAuth 2.0',
  [AuthorizationType.OAUTH1]: 'OAuth 1.0',
};

/** The fields of each authorization type, without the type itself. */
const FORMS: { [K in AuthorizationTypeOrNone]: FormComponentConfiguration } = {
  [AUTHORIZATION_NONE]: {},
  [AuthorizationType.INHERIT]: {},
  [AuthorizationType.BEARER]: {
    token: {
      type: 'text',
      label: 'Token',
      placeholder: 'Enter bearer token',
    },
  },
  [AuthorizationType.BASIC]: {
    username: {
      type: 'text',
      label: 'Username',
      placeholder: 'Enter username',
    },
    password: {
      type: 'password',
      label: 'Password',
      placeholder: 'Enter password',
    },
  },
  [AuthorizationType.OAUTH2]: {
    method: {
      type: 'select',
      label: 'Grant Type',
      options: [
        { value: OAuth2Method.CLIENT_CREDENTIALS, label: 'Client Credentials' },
        { value: OAuth2Method.AUTHORIZATION_CODE, label: 'Authorization Code' },
        { value: OAuth2Method.AUTHORIZATION_CODE_PKCE, label: 'Authorization Code with PKCE' },
      ],
    },
  },
  [AuthorizationType.OAUTH1]: {
    method: {
      type: 'select',
      label: 'Flow',
      options: [
        { value: OAuth1Method.EXISTING_TOKEN, label: 'Existing Token / Two-legged' },
        { value: OAuth1Method.AUTHORIZATION, label: 'Authorization (3-legged)' },
      ],
    },
    consumerKey: {
      type: 'text',
      label: 'Consumer Key',
      placeholder: 'Enter consumer key',
    },
    consumerSecret: {
      type: 'password',
      label: 'Consumer Secret',
      placeholder: 'Enter consumer secret',
    },
  },
};

/** Signature method + realm fields shared by every OAuth 1.0 grant type. */
const OAUTH1_SHARED_FORM: FormComponentConfiguration = {
  signatureMethod: {
    type: 'select',
    label: 'Signature Method',
    options: [
      { value: OAuth1SignatureMethod.HMAC_SHA1, label: 'HMAC-SHA1' },
      { value: OAuth1SignatureMethod.HMAC_SHA256, label: 'HMAC-SHA256' },
      { value: OAuth1SignatureMethod.PLAINTEXT, label: 'PLAINTEXT' },
    ],
  },
  realm: {
    type: 'text',
    label: 'Realm',
    placeholder: '(optional) Enter realm',
  },
};

const OAUTH1_FORMS: { [K in OAuth1Method]: FormComponentConfiguration } = {
  [OAuth1Method.EXISTING_TOKEN]: {
    token: {
      type: 'text',
      label: 'Access Token',
      placeholder: '(optional) Enter access token',
    },
    tokenSecret: {
      type: 'password',
      label: 'Token Secret',
      placeholder: '(optional) Enter token secret',
    },
    ...OAUTH1_SHARED_FORM,
  },
  [OAuth1Method.AUTHORIZATION]: {
    requestTokenUrl: {
      type: 'text',
      label: 'Request Token URL',
      placeholder: 'https://example.com/oauth/request_token',
    },
    authorizationUrl: {
      type: 'text',
      label: 'Authorization URL',
      placeholder: 'https://example.com/oauth/authorize',
    },
    accessTokenUrl: {
      type: 'text',
      label: 'Access Token URL',
      placeholder: 'https://example.com/oauth/access_token',
    },
    callbackUrl: {
      type: 'text',
      label: 'Callback URL',
      placeholder: 'https://example.com/oauth/callback',
    },
    ...OAUTH1_SHARED_FORM,
  },
};

const OAUTH2_BASE_FORM: FormComponentConfiguration = {
  clientId: {
    type: 'text',
    label: 'Client ID',
    placeholder: 'Enter client ID',
  },
  clientSecret: {
    type: 'password',
    label: 'Client Secret',
    placeholder: 'Enter client secret',
  },
  issuerUrl: {
    type: 'text',
    label: 'Issuer URL',
    placeholder: 'https://example.com/oauth2/issuer',
  },
  tokenUrl: {
    type: 'text',
    label: 'Access Token URL',
    placeholder: 'https://example.com/oauth2/token',
  },
  scope: {
    type: 'text',
    label: 'Scope',
    placeholder: '(optional, space-separated)',
  },
  clientAuthenticationMethod: {
    type: 'select',
    label: 'Client Authentication',
    options: [
      {
        value: OAuth2ClientAuthenticationMethod.BASIC_AUTH,
        label: 'Send Credentials as Basic Auth Header',
      },
      {
        value: OAuth2ClientAuthenticationMethod.REQUEST_BODY,
        label: 'Send Credentials in Request Body',
      },
    ],
  },
};

const OAUTH2_FORMS: { [K in OAuth2Method]: FormComponentConfiguration } = {
  [OAuth2Method.CLIENT_CREDENTIALS]: {
    ...OAUTH2_BASE_FORM,
  },
  [OAuth2Method.AUTHORIZATION_CODE]: {
    ...OAUTH2_BASE_FORM,
    authorizationUrl: {
      type: 'text',
      label: 'Authorization URL',
      placeholder: 'https://example.com/oauth2/authorize',
    },
    callbackUrl: {
      type: 'text',
      label: 'Callback URL',
      placeholder: 'https://example.com/oauth2/callback',
    },
    state: {
      type: 'text',
      label: 'State',
      placeholder: 'Enter state (optional, will be generated if empty)',
    },
    cache: {
      type: 'checkbox',
      label: 'Keep Browser Session Cache',
    },
  },
  [OAuth2Method.AUTHORIZATION_CODE_PKCE]: {
    ...OAUTH2_BASE_FORM,
    authorizationUrl: {
      type: 'text',
      label: 'Authorization URL',
      placeholder: 'https://example.com/oauth2/authorize',
    },
    callbackUrl: {
      type: 'text',
      label: 'Callback URL',
      placeholder: 'https://example.com/oauth2/callback',
    },
    codeChallengeMethod: {
      type: 'select',
      label: 'Code Challenge Method',
      options: [
        {
          value: OAuth2PKCECodeChallengeMethod.S256,
          label: 'S256 (Recommended)',
        },
        {
          value: OAuth2PKCECodeChallengeMethod.PLAIN,
          label: 'Plain',
        },
      ],
    },
    codeVerifier: {
      type: 'text',
      label: 'Code Verifier',
      placeholder: 'Enter code verifier (optional, will be generated if empty)',
    },
    state: {
      type: 'text',
      label: 'State',
      placeholder: 'Enter state (optional, will be generated if empty)',
    },
    cache: {
      type: 'checkbox',
      label: 'Keep Browser Session Cache',
    },
  },
};

/** The forms of the authorization types whose form depends on a method, by method. */
const METHOD_FORMS: Partial<
  Record<AuthorizationTypeOrNone, Record<string, FormComponentConfiguration>>
> = {
  [AuthorizationType.OAUTH1]: OAUTH1_FORMS,
  [AuthorizationType.OAUTH2]: OAUTH2_FORMS,
};

/** The description of the given type, if it has one. */
function getDescription(
  type: AuthorizationTypeOrNone,
  level: AuthorizationLevel,
  inheritedDescription?: string
): string | undefined {
  switch (type) {
    case AuthorizationType.INHERIT:
      return inheritedDescription;
    case AUTHORIZATION_NONE:
      return level === 'collection'
        ? 'Requests that inherit their authorization are sent without one.'
        : 'No authorization will be applied to this request.';
  }
}

/**
 * Builds the form of an authorization: the type to choose, its description and its fields. OAuth
 * fields depend on the method as well.
 * @param type the authorization type, or none
 * @param method the OAuth method of an OAuth authorization
 * @param level what the authorization belongs to. Determines the types to choose from.
 * @param inheritedDescription describes what an inheriting authorization inherits
 */
export function buildAuthorizationForm(
  type: AuthorizationTypeOrNone,
  method: string | undefined,
  level: AuthorizationLevel,
  inheritedDescription?: string
): FormComponentConfiguration {
  const description = getDescription(type, level, inheritedDescription);
  return {
    type: {
      type: 'select',
      label: 'Authorization Type',
      options: TYPES[level].map((value) => ({ value, label: AUTHORIZATION_TYPE_LABELS[value] })),
    },
    ...(description != null ? { description: { type: 'label', text: description } } : {}),
    ...FORMS[type],
    ...(method != null ? METHOD_FORMS[type]?.[method] : undefined),
  };
}
