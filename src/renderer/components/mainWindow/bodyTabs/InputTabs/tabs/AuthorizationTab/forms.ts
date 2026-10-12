import {
  AuthorizationInformation,
  AuthorizationType,
  OAuth1Method,
  OAuth1SignatureMethod,
  OAuth2ClientAuthenticationMethod,
  OAuth2Method,
  OAuth2PKCECodeChallengeMethod,
} from 'shim/objects';
import type { FormComponentConfiguration, FormFieldConfig } from './ModularForm';

export const AUTHORIZATION_NONE = 'none' as const;
export type AuthorizationTypeOrNone = AuthorizationType | typeof AUTHORIZATION_NONE;

const LABELS: { [K in AuthorizationTypeOrNone]: string } = {
  [AUTHORIZATION_NONE]: 'None',
  [AuthorizationType.INHERIT]: 'Inherit from collection',
  [AuthorizationType.BEARER]: 'Bearer Token',
  [AuthorizationType.BASIC]: 'Basic Auth',
  [AuthorizationType.OAUTH2]: 'OAuth 2.0',
  [AuthorizationType.OAUTH1]: 'OAuth 1.0',
};

const BASE_FORM = {
  type: {
    type: 'select' as const,
    label: 'Authorization Type',
    options: Object.entries(LABELS).map(([value, label]) => ({ value, label })),
    defaultValue: AUTHORIZATION_NONE,
  },
};

export const FORMS: { [K in AuthorizationTypeOrNone]: FormComponentConfiguration } = {
  [AUTHORIZATION_NONE]: {
    ...BASE_FORM,
    description: {
      type: 'label',
      text: 'No authorization will be applied to this request.',
    },
  },
  [AuthorizationType.INHERIT]: {
    ...BASE_FORM,
    description: {
      type: 'label',
      text: 'This request will inherit authorization settings from the collection.',
    },
  },
  [AuthorizationType.BEARER]: {
    ...BASE_FORM,
    token: {
      type: 'text',
      label: 'Token',
      placeholder: 'Enter bearer token',
    },
  },
  [AuthorizationType.BASIC]: {
    ...BASE_FORM,
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
    ...BASE_FORM,
    method: {
      type: 'select',
      label: 'Grant Type',
      options: [
        { value: OAuth2Method.CLIENT_CREDENTIALS, label: 'Client Credentials' },
        { value: OAuth2Method.AUTHORIZATION_CODE, label: 'Authorization Code' },
        { value: OAuth2Method.AUTHORIZATION_CODE_PKCE, label: 'Authorization Code with PKCE' },
      ],
      defaultValue: OAuth2Method.CLIENT_CREDENTIALS,
    },
  },
  [AuthorizationType.OAUTH1]: {
    ...BASE_FORM,
    method: {
      type: 'select',
      label: 'Flow',
      options: [
        { value: OAuth1Method.EXISTING_TOKEN, label: 'Existing Token / Two-legged' },
        { value: OAuth1Method.AUTHORIZATION, label: 'Authorization (3-legged)' },
      ],
      defaultValue: OAuth1Method.EXISTING_TOKEN,
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
    defaultValue: OAuth1SignatureMethod.HMAC_SHA1,
  },
  realm: {
    type: 'text',
    label: 'Realm',
    placeholder: '(optional) Enter realm',
  },
};

export const OAUTH1_FORMS: { [K in OAuth1Method]: FormComponentConfiguration } = {
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
    defaultValue: OAuth2ClientAuthenticationMethod.BASIC_AUTH,
  },
};

export const OAUTH2_FORMS: { [K in OAuth2Method]: FormComponentConfiguration } = {
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
      defaultValue: true,
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
      defaultValue: OAuth2PKCECodeChallengeMethod.S256,
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
      defaultValue: true,
    },
  },
};

function isOAuth1Method(method: string): method is OAuth1Method {
  return Object.values<string>(OAuth1Method).includes(method);
}

function isOAuth2Method(method: string): method is OAuth2Method {
  return Object.values<string>(OAuth2Method).includes(method);
}

/**
 * Returns the form of the given authorization type. OAuth forms depend on the method as well.
 * @param type the authorization type, or none
 * @param method the OAuth method. Defaults to the default of the method field.
 */
export function getAuthorizationForm(
  type: AuthorizationTypeOrNone,
  method?: string
): FormComponentConfiguration {
  const form = FORMS[type];
  const methodField = form.method;
  method ??= methodField?.type === 'select' ? methodField.defaultValue : undefined;
  if (method == null) return form;
  if (type === AuthorizationType.OAUTH2 && isOAuth2Method(method)) {
    return { ...form, ...OAUTH2_FORMS[method] };
  } else if (type === AuthorizationType.OAUTH1 && isOAuth1Method(method)) {
    return { ...form, ...OAUTH1_FORMS[method] };
  }
  return form;
}

/** The value that the form shows for a field without a value, see `ModularForm`. */
function getDefaultValue(field: FormFieldConfig): string | number | boolean | undefined {
  switch (field.type) {
    case 'label':
      return undefined;
    case 'number':
      return field.defaultValue ?? 0;
    case 'checkbox':
      return field.defaultValue ?? true;
    case 'select':
      return field.defaultValue ?? field.options[0]?.value;
    default:
      return field.defaultValue ?? '';
  }
}

/**
 * Creates a complete authorization of the given type in which every field has the default value
 * of its form field. The form would otherwise fill in the missing fields one at a time, and none
 * of these partial objects is a valid {@link AuthorizationInformation}.
 * @param type the authorization type
 * @param method the OAuth method. Defaults to the default of the method field.
 */
export function createDefaultAuthorization(
  type: AuthorizationType,
  method?: string
): AuthorizationInformation {
  const values: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(getAuthorizationForm(type, method))) {
    const value = getDefaultValue(field);
    if (value !== undefined) values[key] = value;
  }
  if (method != null) values.method = method;
  return AuthorizationInformation.parse({ ...values, type });
}

/**
 * Applies a change made in the authorization form. If the type or the OAuth method changes, the
 * result starts from {@link createDefaultAuthorization}, keeping the fields that the old and the
 * new method share. The result is always a complete, valid authorization.
 * @param current the current authorization
 * @param delta the changed fields
 * @throws ZodError if the change makes the authorization invalid
 */
export function applyAuthorizationChange(
  current: AuthorizationInformation | undefined,
  delta: Partial<AuthorizationInformation>
): AuthorizationInformation {
  const type = delta.type ?? current?.type;
  if (type == null) throw new Error('The authorization type is missing');

  const currentMethod = current != null && 'method' in current ? current.method : undefined;
  const deltaMethod = 'method' in delta ? delta.method : undefined;
  const method = deltaMethod ?? (current?.type === type ? currentMethod : undefined);
  if (current != null && current.type === type && method === currentMethod) {
    return AuthorizationInformation.parse({ ...current, ...delta });
  }

  const defaults = createDefaultAuthorization(type, method);
  const shared =
    current?.type === type
      ? Object.entries(current).filter(([key]) => key in defaults && key !== 'method')
      : [];
  return AuthorizationInformation.parse({ ...defaults, ...Object.fromEntries(shared), ...delta });
}
