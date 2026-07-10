import { Assertion, AssertionOperator, AssertionType } from 'shim/objects/assertion';

/** Builds a human-readable label for an assertion from its type, operator, target and expected value. */
export function buildAssertionName(
  assertion: Pick<Assertion, 'type' | 'operator'> & Partial<Assertion>
): string {
  switch (assertion.type) {
    case AssertionType.STATUS_CODE:
      return assertion.operator === AssertionOperator.IN_RANGE
        ? `Status code is in ${assertion.expected ?? ''}`
        : `Status code equals ${assertion.expected ?? ''}`;
    case AssertionType.RESPONSE_TIME:
      return `Response time below ${assertion.expected ?? ''} ms`;
    case AssertionType.HEADER:
      return buildTargetName('Header', assertion);
    case AssertionType.JSON_PATH:
      return buildTargetName('JSON path', assertion);
  }
}

function buildTargetName(
  label: string,
  assertion: Pick<Assertion, 'operator'> & Partial<Assertion>
): string {
  const target = assertion.target ?? '';
  if (
    assertion.operator === AssertionOperator.PRESENT ||
    assertion.operator === AssertionOperator.EXISTS
  ) {
    return `${label} ${target} exists`;
  }

  const expected = assertion.expected ?? '';
  return `${label} ${target} ${assertion.operator} ${expected}`;
}
