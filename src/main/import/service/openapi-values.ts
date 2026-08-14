/**
 * Derives Trufos request values — titles, headers, query parameters — from OpenAPI operations and
 * their parameters.
 */

import { TrufosHeader } from 'shim/objects/headers';
import { TrufosQueryParam } from 'shim/objects/query-param';
import { truncate } from 'shim/string';
import type { OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from 'openapi-types';

export type Operation =
  OpenAPIV2.OperationObject | OpenAPIV3.OperationObject | OpenAPIV3_1.OperationObject;
export type Parameter =
  OpenAPIV2.ParameterObject | OpenAPIV3.ParameterObject | OpenAPIV3_1.ParameterObject;
export type PathItem =
  OpenAPIV2.PathItemObject | OpenAPIV3.PathItemObject | OpenAPIV3_1.PathItemObject;

/** The maximum length of a request title derived from an OpenAPI operation summary. */
const MAX_TITLE_LENGTH = 100;

/**
 * Derives the title of an imported request. The title is also the source of its directory name,
 * so it must stay short and should identify the operation. The HTTP method is not part of it,
 * because it is shown separately in the UI.
 * @param operation the operation to derive the title from
 * @param pathTemplate the path of the operation, e.g. `/apps/{appId}/versions`
 * @returns the shortened operation summary, or the operation ID, or the path as last resort
 */
export function getTitle(operation: Operation, pathTemplate: string): string {
  const summary = shortenSummary(operation.summary);
  if (summary !== '') return summary;

  const operationId = operation.operationId?.trim();
  if (operationId != null && operationId !== '') return operationId;

  return pathTemplate;
}

/**
 * Shortens an operation summary to a single line of at most {@link MAX_TITLE_LENGTH} characters.
 * Summaries are meant to be short descriptions, but specs in the wild put the whole endpoint
 * documentation in them, which makes for unreadable titles and directory names.
 * @param summary the summary of the operation, if any
 * @returns the first sentence of the summary, or an empty string if there is no summary
 */
function shortenSummary(summary?: string) {
  const firstLine = summary?.split(/\r?\n/, 1)[0]?.trim().replace(/\.$/, '') ?? '';
  return truncate(firstLine, MAX_TITLE_LENGTH, ' ');
}

/**
 * @param pathItem the path item the operation belongs to, whose parameters apply to it as well
 * @param operation the operation to collect the parameters of
 * @returns all parameters that apply to the operation
 */
export function getParameters(pathItem: PathItem, operation: Operation) {
  return [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])].filter(
    (parameter) => parameter != null && 'name' in parameter && 'in' in parameter
  ) as Parameter[];
}

/**
 * Imports a query parameter. Optional parameters that the spec gives no value for are imported
 * as inactive, because sending them empty (`?search=&filter=`) is not what the endpoint expects
 * and specs commonly declare dozens of optional parameters per operation.
 * @param parameter the query parameter to import
 * @returns the query parameter of the request
 */
export function importQueryParam(parameter: Parameter): TrufosQueryParam {
  const value = stringifyParameterValue(parameter) ?? '';
  return { key: parameter.name, value, isActive: parameter.required === true || value !== '' };
}

/**
 * @param parameters the parameters of the operation
 * @returns the header parameters as request headers
 */
export function importHeaders(parameters: Parameter[]): TrufosHeader[] {
  return parameters
    .filter((parameter) => parameter.in === 'header')
    .map((parameter) => ({
      key: parameter.name,
      value: stringifyParameterValue(parameter) ?? '',
      isActive: true,
    }));
}

/**
 * @param parameter the parameter to derive a value from
 * @returns the example or default value of the parameter as string, or undefined if it has none
 */
export function stringifyParameterValue(parameter: Parameter) {
  if ('example' in parameter && parameter.example != null) {
    return stringifyPrimitive(parameter.example);
  }
  if ('schema' in parameter && parameter.schema != null) {
    const schema = parameter.schema as { default?: unknown; example?: unknown };
    return stringifyPrimitive(schema.example ?? schema.default);
  }

  return undefined;
}

/**
 * @param value the example value to stringify
 * @returns the value as string, JSON-formatted if it is a structured value
 */
export function stringifyExample(value: unknown) {
  if (value == null) return undefined;
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

function stringifyPrimitive(value: unknown) {
  if (value == null) return undefined;
  return typeof value === 'string' ? value : String(value);
}
