/**
 * URL handling for OpenAPI imports: completing partial server URLs and joining paths.
 */

import type { OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from 'openapi-types';

/** The base URL used when a document does not declare a usable server. */
export const DEFAULT_BASE_URL = 'http://localhost';

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
