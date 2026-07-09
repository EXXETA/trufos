import { Assertion, AssertionOperator, AssertionType } from 'shim/objects/assertion';

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

export function shouldUpdateAssertionName(assertion: Assertion): boolean {
  return assertion.nameManuallyEdited !== true && assertion.name === buildAssertionName(assertion);
}

export function withUpdatedAssertionName(
  assertion: Assertion,
  updatedAssertion: Partial<Assertion>
): Partial<Assertion> {
  const nextAssertion = { ...assertion, ...updatedAssertion };
  if (!shouldUpdateAssertionName(assertion)) return updatedAssertion;
  return {
    ...updatedAssertion,
    name: buildAssertionName(nextAssertion),
  };
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
