/**
 * URL handling for OpenAPI imports: completing partial server URLs, joining paths, and converting
 * path templates into Trufos template variables.
 */

import { VARIABLE_NAME_REGEX } from 'shim/objects/variables';
import type { OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from 'openapi-types';

/** The base URL used when a document does not declare a usable server. */
export const DEFAULT_BASE_URL = 'http://localhost';

/** Matches a path template parameter, e.g. the `{appId}` in `/apps/{appId}/versions`. */
export const PATH_PARAMETER_REGEX = /\{([^{}/]*)\}/g;

/**
 * @param server the server to resolve
 * @returns the server URL with all of its variables replaced by their default values
 */
export function resolveServerUrl(server?: OpenAPIV3.ServerObject | OpenAPIV3_1.ServerObject) {
  return Object.entries(server?.variables ?? {}).reduce((url, [key, variable]) => {
    return url.replaceAll(`{${key}}`, variable.default);
  }, server?.url ?? '');
}

/**
 * Completes a partial server URL to an absolute one. Specs in the wild declare servers as bare
 * hosts, protocol-relative URLs, or paths, all of which requests cannot be sent to as they are.
 * @param url the server URL as declared in the document
 * @returns the completed absolute URL, without a trailing slash
 */
export function completeBaseUrl(url: string) {
  const trimmed = url.trim();
  if (trimmed === '') return DEFAULT_BASE_URL;
  if (URL.canParse(trimmed)) return removeTrailingSlash(trimmed);
  if (trimmed.startsWith('//')) return removeTrailingSlash(`https:${trimmed}`);
  if (trimmed.startsWith('/')) return removeTrailingSlash(`${DEFAULT_BASE_URL}${trimmed}`);

  const firstSegment = trimmed.split('/')[0];
  if (firstSegment.includes('.') || firstSegment.includes(':')) {
    return removeTrailingSlash(`https://${trimmed}`);
  }

  return removeTrailingSlash(`${DEFAULT_BASE_URL}/${trimmed}`);
}

/**
 * @param document the Swagger 2.0 document to derive the base URL from
 * @returns the completed base URL built from the scheme, host and base path of the document
 */
export function getSwaggerBaseUrl(document: OpenAPIV2.Document) {
  const scheme = document.schemes?.[0] ?? 'https';
  const host = document.host ?? '';
  const basePath = document.basePath ?? '';
  return completeBaseUrl(host === '' ? basePath : `${scheme}://${host}${basePath}`);
}

/**
 * @param baseUrl the base URL to join the path onto
 * @param pathTemplate the path of the operation, used as is if it is an absolute URL itself
 * @returns the joined URL
 */
export function joinUrl(baseUrl: string, pathTemplate: string) {
  if (URL.canParse(pathTemplate)) return pathTemplate;
  const normalizedPath = pathTemplate.startsWith('/') ? pathTemplate : `/${pathTemplate}`;
  return `${removeTrailingSlash(baseUrl)}${normalizedPath}`;
}

/**
 * Converts the OpenAPI path template syntax `{appId}` into the Trufos template variable syntax
 * `{{appId}}`, so that the parameter is resolved when the request is sent instead of being sent
 * literally. Parameters whose name cannot be a Trufos variable are left untouched, because
 * turning them into templates would only produce URLs that never resolve.
 * @param pathTemplate the path of the operation, e.g. `/apps/{appId}/versions`
 * @returns the path with all of its parameters in Trufos template variable syntax
 */
export function toTemplateVariables(pathTemplate: string) {
  return pathTemplate.replace(PATH_PARAMETER_REGEX, (parameter, name: string) =>
    VARIABLE_NAME_REGEX.test(name) ? `{{${name}}}` : parameter
  );
}

/**
 * @param server the server to derive an environment key from
 * @returns the description of the server, or its URL without the scheme, which carries no
 *  meaning for the user, while the host and path tell the servers apart
 */
export function getEnvironmentKey(server: { url: string; description?: string }) {
  return server.description?.trim() || server.url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
}

function removeTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}
