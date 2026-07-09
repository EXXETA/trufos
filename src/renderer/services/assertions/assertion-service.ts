import { IpcPushStream } from '@/lib/ipc-stream';
import {
  Assertion,
  AssertionOperator,
  AssertionResult,
  AssertionType,
} from 'shim/objects/assertion';
import { TrufosResponse } from 'shim/objects/response';

const MAX_RESPONSE_BODY_BYTES = 1024 * 1024;

export async function evaluateAssertions(
  assertions: Assertion[] | undefined,
  response: TrufosResponse
): Promise<AssertionResult[]> {
  const activeAssertions = assertions?.filter((assertion) => assertion.isActive) ?? [];
  const needsBody = activeAssertions.some(
    (assertion) => assertion.type === AssertionType.JSON_PATH
  );
  const body = needsBody ? await readResponseBodySafely(response) : undefined;
  const jsonBody = body == null ? undefined : parseJson(body);

  return activeAssertions.map((assertion) => evaluateAssertion(assertion, response, jsonBody));
}

function evaluateAssertion(
  assertion: Assertion,
  response: TrufosResponse,
  jsonBody: unknown
): AssertionResult {
  try {
    switch (assertion.type) {
      case AssertionType.STATUS_CODE:
        return evaluateStatusCodeAssertion(assertion, response);
      case AssertionType.RESPONSE_TIME:
        return evaluateResponseTimeAssertion(assertion, response);
      case AssertionType.HEADER:
        return evaluateHeaderAssertion(assertion, response);
      case AssertionType.JSON_PATH:
        return evaluateJsonPathAssertion(assertion, jsonBody);
    }
  } catch (error) {
    return {
      assertionId: assertion.id,
      name: assertion.name,
      passed: false,
      message: error instanceof Error ? error.message : 'Assertion failed',
    };
  }
}

function evaluateStatusCodeAssertion(
  assertion: Assertion,
  response: TrufosResponse
): AssertionResult {
  const status = response.metaInfo.status;

  if (assertion.operator === AssertionOperator.IN_RANGE) {
    const [min, max] = parseRange(assertion.expected);
    return buildResult(
      assertion,
      status >= min && status <= max,
      `Expected ${min}-${max}, got ${status}`
    );
  }

  const expected = parseNumber(assertion.expected, 'Expected status code');
  return buildResult(assertion, status === expected, `Expected ${expected}, got ${status}`);
}

function evaluateResponseTimeAssertion(
  assertion: Assertion,
  response: TrufosResponse
): AssertionResult {
  const expected = parseNumber(assertion.expected, 'Expected response time');
  const duration = response.metaInfo.duration;
  return buildResult(
    assertion,
    duration < expected,
    `Expected below ${expected}ms, got ${Math.round(duration)}ms`
  );
}

function evaluateHeaderAssertion(assertion: Assertion, response: TrufosResponse): AssertionResult {
  const headerName = assertion.target?.trim();
  if (!headerName) throw new Error('Header name missing');

  const value = findHeaderValue(response, headerName);
  if (assertion.operator === AssertionOperator.PRESENT) {
    return buildResult(assertion, value != null, `Expected header "${headerName}" to be present`);
  }

  const actual = value == null ? undefined : headerToString(value);
  const expected = assertion.expected ?? '';
  const passed =
    assertion.operator === AssertionOperator.CONTAINS
      ? actual?.includes(expected) === true
      : actual === expected;

  return buildResult(
    assertion,
    passed,
    `Expected header "${headerName}" ${assertion.operator} "${expected}", got "${actual ?? ''}"`
  );
}

function evaluateJsonPathAssertion(assertion: Assertion, jsonBody: unknown): AssertionResult {
  if (jsonBody == null) throw new Error('Response body is not valid JSON');

  const path = assertion.target?.trim();
  if (!path) throw new Error('JSON path missing');

  const resolved = resolveJsonPath(jsonBody, path);
  if (assertion.operator === AssertionOperator.EXISTS) {
    return buildResult(assertion, resolved.exists, `Expected JSON path "${path}" to exist`);
  }

  const actual = formatJsonValue(resolved.value);
  const expected = assertion.expected ?? '';
  const passed =
    assertion.operator === AssertionOperator.CONTAINS
      ? actual.includes(expected)
      : actual === expected;

  return buildResult(
    assertion,
    passed,
    `Expected JSON path "${path}" ${assertion.operator} "${expected}", got "${actual}"`
  );
}

async function readResponseBody(response: TrufosResponse): Promise<string | undefined> {
  if (!response.id) return undefined;
  const stream = await IpcPushStream.open(response, 'utf-8', MAX_RESPONSE_BODY_BYTES);
  return await stream.readAll();
}

async function readResponseBodySafely(response: TrufosResponse): Promise<string | undefined> {
  try {
    return await readResponseBody(response);
  } catch {
    return undefined;
  }
}

function parseJson(body: string | undefined): unknown {
  if (body == null || body.trim() === '') return undefined;
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return undefined;
  }
}

function parseNumber(value: string | undefined, fieldName: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${fieldName} must be a number`);
  return parsed;
}

function parseRange(value: string | undefined): [number, number] {
  const [min, max] = value?.split('-').map((part) => Number(part.trim())) ?? [];
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    throw new Error('Expected status range must use min-max format');
  }
  return [min, max];
}

function findHeaderValue(response: TrufosResponse, name: string): string | string[] | undefined {
  const lowerName = name.toLowerCase();
  const entry = Object.entries(response.headers).find(([key]) => key.toLowerCase() === lowerName);
  return entry?.[1];
}

function headerToString(value: string | string[]): string {
  return Array.isArray(value) ? value.join(', ') : value;
}

function resolveJsonPath(root: unknown, path: string): { exists: boolean; value: unknown } {
  const segments =
    path
      .replace(/^\$\./, '')
      .replace(/^\$/, '')
      .match(/[^.[\]]+/g) ?? [];
  let current = root;

  for (const segment of segments) {
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        return { exists: false, value: undefined };
      }
      current = current[index];
    } else if (isRecord(current) && segment in current) {
      current = current[segment];
    } else {
      return { exists: false, value: undefined };
    }
  }

  return { exists: true, value: current };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatJsonValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '[complex value]';
}

function buildResult(assertion: Assertion, passed: boolean, message: string): AssertionResult {
  return {
    assertionId: assertion.id,
    name: assertion.name,
    passed,
    message: passed ? 'Passed' : message,
  };
}
