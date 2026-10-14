import {
  AuthorizationInformation,
  AuthorizationType,
  OAuth1AuthorizationInformation,
  OAuth1Method,
  OAuth1SignatureMethod,
  OAuth2AuthorizationInformation,
  OAuth2ClientAuthenticationMethod,
  OAuth2Method,
  OAuth2PKCECodeChallengeMethod,
} from 'shim/objects';

const OAUTH2_BASE = {
  type: AuthorizationType.OAUTH2,
  issuerUrl: '',
  clientId: '',
  clientSecret: '',
  tokenUrl: '',
  scope: '',
  clientAuthenticationMethod: OAuth2ClientAuthenticationMethod.BASIC_AUTH,
} as const;

const OAUTH2_DEFAULTS: { [M in OAuth2Method]: OAuth2AuthorizationInformation & { method: M } } = {
  [OAuth2Method.CLIENT_CREDENTIALS]: {
    ...OAUTH2_BASE,
    method: OAuth2Method.CLIENT_CREDENTIALS,
  },
  [OAuth2Method.AUTHORIZATION_CODE]: {
    ...OAUTH2_BASE,
    method: OAuth2Method.AUTHORIZATION_CODE,
    authorizationUrl: '',
    callbackUrl: '',
    state: '',
    cache: true,
  },
  [OAuth2Method.AUTHORIZATION_CODE_PKCE]: {
    ...OAUTH2_BASE,
    method: OAuth2Method.AUTHORIZATION_CODE_PKCE,
    authorizationUrl: '',
    callbackUrl: '',
    codeChallengeMethod: OAuth2PKCECodeChallengeMethod.S256,
    codeVerifier: '',
    state: '',
    cache: true,
  },
};

const OAUTH1_BASE = {
  type: AuthorizationType.OAUTH1,
  consumerKey: '',
  consumerSecret: '',
  signatureMethod: OAuth1SignatureMethod.HMAC_SHA1,
  realm: '',
} as const;

const OAUTH1_DEFAULTS: { [M in OAuth1Method]: OAuth1AuthorizationInformation & { method: M } } = {
  [OAuth1Method.EXISTING_TOKEN]: {
    ...OAUTH1_BASE,
    method: OAuth1Method.EXISTING_TOKEN,
    token: '',
    tokenSecret: '',
  },
  [OAuth1Method.AUTHORIZATION]: {
    ...OAUTH1_BASE,
    method: OAuth1Method.AUTHORIZATION,
    requestTokenUrl: '',
    authorizationUrl: '',
    accessTokenUrl: '',
    callbackUrl: '',
  },
};

/** Returns the OAuth method of an authorization, if it has one. */
export function getMethod(auth: Partial<AuthorizationInformation> | undefined): string | undefined {
  return auth != null && 'method' in auth ? auth.method : undefined;
}

function getDefault<T extends object>(defaults: Record<string, T>, method: string): T {
  const entry = Object.entries(defaults).find(([key]) => key === method);
  if (entry == null) throw new Error(`Unknown authorization method ${method}`);
  return { ...entry[1] };
}

/**
 * Creates a complete authorization of the given type with default values. Partial authorizations
 * are no valid {@link AuthorizationInformation}.
 * @param type the authorization type
 * @param method the OAuth method. Defaults to the first one.
 * @throws Error if the method does not exist for the type
 */
export function createDefaultAuthorization(
  type: AuthorizationType,
  method?: string
): AuthorizationInformation {
  switch (type) {
    case AuthorizationType.INHERIT:
      return { type };
    case AuthorizationType.BEARER:
      return { type, token: '' };
    case AuthorizationType.BASIC:
      return { type, username: '', password: '' };
    case AuthorizationType.OAUTH2:
      return getDefault(OAUTH2_DEFAULTS, method ?? OAuth2Method.CLIENT_CREDENTIALS);
    case AuthorizationType.OAUTH1:
      return getDefault(OAUTH1_DEFAULTS, method ?? OAuth1Method.EXISTING_TOKEN);
  }
}

/**
 * Applies a change made in the authorization form. If the type or the OAuth method changes, the
 * result starts from {@link createDefaultAuthorization}, keeping the fields that the old and the
 * new method share. The result is always a complete, valid authorization.
 * @param current the current authorization
 * @param delta the changed fields
 * @throws Error if the change makes the authorization invalid
 */
export function applyAuthorizationChange(
  current: AuthorizationInformation | undefined,
  delta: Partial<AuthorizationInformation>
): AuthorizationInformation {
  const type = delta.type ?? current?.type;
  if (type == null) throw new Error('The authorization type is missing');

  const currentMethod = getMethod(current);
  const method = getMethod(delta) ?? (current?.type === type ? currentMethod : undefined);
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
