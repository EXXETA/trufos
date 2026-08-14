/**
 * Maps the security of an OpenAPI or Swagger document onto what Trufos can represent: an
 * authorization, plus the headers and query parameters that API keys boil down to.
 */

import { TrufosHeader } from 'shim/objects/headers';
import { TrufosQueryParam } from 'shim/objects/query-param';
import {
  AuthorizationInformationNoInherit,
  AuthorizationType,
  OAuth2ClientAuthenticationMethod,
  OAuth2Method,
} from 'shim';
import type { OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from 'openapi-types';

type OpenApiDocument = OpenAPIV2.Document | OpenAPIV3.Document | OpenAPIV3_1.Document;
type OpenApi3SecurityScheme = OpenAPIV3.SecuritySchemeObject | OpenAPIV3_1.SecuritySchemeObject;
type SecurityScheme = OpenAPIV2.SecuritySchemeObject | OpenApi3SecurityScheme;
type SecurityRequirement =
  OpenAPIV2.SecurityRequirementObject | OpenAPIV3.SecurityRequirementObject;
type OAuth2Flow = {
  authorizationUrl?: string;
  tokenUrl?: string;
};

/** What a single security scheme contributes to a request. */
type SecuritySchemeImport = {
  auth?: AuthorizationInformationNoInherit;
  header?: TrufosHeader;
  queryParam?: TrufosQueryParam;
};

/** What a met security requirement contributes to a request. */
export type ImportedSecurity = {
  auth?: AuthorizationInformationNoInherit;
  headers: TrufosHeader[];
  query: TrufosQueryParam[];
};

/**
 * Imports the security of a document or operation. The requirements are alternatives, of which
 * only one has to be met, so the first one that Trufos can represent completely is used. Empty
 * requirements are skipped, because they only state that the authorization is optional, which
 * makes for a less useful request than actually authorizing it.
 * @param document the document the security schemes are defined in
 * @param requirements the security requirements of the document or of one of its operations
 * @returns what the requirement contributes to a request, or undefined if none is supported
 */
export function importSecurity(
  document: OpenApiDocument,
  requirements?: SecurityRequirement[]
): ImportedSecurity | undefined {
  for (const requirement of requirements ?? []) {
    const schemeNames = Object.keys(requirement);
    if (schemeNames.length === 0) continue;

    // all schemes of a requirement must be met, so it is only usable if all of them are supported
    const parts: SecuritySchemeImport[] = [];
    for (const schemeName of schemeNames) {
      const scheme = getSecurityScheme(document, schemeName);
      const part =
        scheme == null ? undefined : importSecurityScheme(scheme, requirement[schemeName] ?? []);
      if (part == null) break;
      parts.push(part);
    }
    if (parts.length !== schemeNames.length) continue;

    return {
      auth: parts.find((part) => part.auth != null)?.auth,
      headers: parts.flatMap((part) => part.header ?? []),
      query: parts.flatMap((part) => part.queryParam ?? []),
    };
  }
}

/**
 * Imports a single security scheme. API keys have no equivalent in Trufos, but they are just a
 * header or query parameter, so they are imported as one with an empty value for the user to
 * fill in. API keys in cookies are not supported, as Trufos has no cookie store.
 * @param scheme the security scheme to import
 * @param scopes the scopes the requirement asks for, only used by OAuth 2.0
 * @returns what the scheme contributes to a request, or undefined if Trufos cannot represent it
 */
function importSecurityScheme(
  scheme: SecurityScheme,
  scopes: string[]
): SecuritySchemeImport | undefined {
  switch (scheme.type) {
    case 'basic': // Swagger 2.0 spells out basic authentication as its own type
      return { auth: { type: AuthorizationType.BASIC, username: '', password: '' } };
    case 'http':
      switch (scheme.scheme?.toLowerCase()) {
        case 'basic':
          return { auth: { type: AuthorizationType.BASIC, username: '', password: '' } };
        case 'bearer':
          return { auth: { type: AuthorizationType.BEARER, token: '' } };
      }
      return;
    case 'oauth2': {
      const auth = importOAuth2Auth(scheme, scopes);
      return auth == null ? undefined : { auth };
    }
    case 'apiKey':
      switch (scheme.in) {
        case 'header':
          return { header: { key: scheme.name, value: '', isActive: true } };
        case 'query':
          return { queryParam: { key: scheme.name, value: '', isActive: true } };
      }
      return;
  }
}

function getSecurityScheme(document: OpenApiDocument, schemeName: string) {
  if ('openapi' in document) {
    return document.components?.securitySchemes?.[schemeName] as OpenApi3SecurityScheme;
  }

  return document.securityDefinitions?.[schemeName];
}

function importOAuth2Auth(
  scheme: SecurityScheme,
  scopes: string[]
): AuthorizationInformationNoInherit | undefined {
  const flow = getOAuth2Flow(scheme);
  if (flow == null) return;

  const base = {
    type: AuthorizationType.OAUTH2 as const,
    issuerUrl: '',
    tokenUrl: flow.tokenUrl ?? '',
    clientId: '',
    clientSecret: '',
    scope: scopes.join(' '),
    clientAuthenticationMethod: OAuth2ClientAuthenticationMethod.BASIC_AUTH,
  };

  if (flow.authorizationUrl != null) {
    return {
      ...base,
      method: OAuth2Method.AUTHORIZATION_CODE,
      authorizationUrl: flow.authorizationUrl,
      callbackUrl: '',
    };
  }

  return {
    ...base,
    method: OAuth2Method.CLIENT_CREDENTIALS,
  };
}

function getOAuth2Flow(scheme: SecurityScheme): OAuth2Flow | undefined {
  if ('flows' in scheme && scheme.flows != null) {
    return (
      scheme.flows.authorizationCode ??
      scheme.flows.clientCredentials ??
      scheme.flows.password ??
      scheme.flows.implicit
    );
  }

  if ('tokenUrl' in scheme || 'authorizationUrl' in scheme) {
    return scheme;
  }
}
