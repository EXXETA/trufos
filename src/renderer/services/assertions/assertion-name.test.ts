import { describe, expect, it } from 'vitest';
import { AssertionOperator, AssertionType } from 'shim/objects/assertion';
import { buildAssertionName } from './assertion-name';

describe('buildAssertionName', () => {
  it('builds names from assertion values', () => {
    expect(
      buildAssertionName({
        type: AssertionType.STATUS_CODE,
        operator: AssertionOperator.EQUALS,
        expected: '200',
      })
    ).toBe('Status code equals 200');
    expect(
      buildAssertionName({
        type: AssertionType.STATUS_CODE,
        operator: AssertionOperator.IN_RANGE,
        expected: '200-299',
      })
    ).toBe('Status code is in 200-299');
    expect(
      buildAssertionName({
        type: AssertionType.RESPONSE_TIME,
        operator: AssertionOperator.BELOW,
        expected: '500',
      })
    ).toBe('Response time below 500 ms');
    expect(
      buildAssertionName({
        type: AssertionType.HEADER,
        operator: AssertionOperator.PRESENT,
        target: 'content-type',
      })
    ).toBe('Header content-type exists');
    expect(
      buildAssertionName({
        type: AssertionType.JSON_PATH,
        operator: AssertionOperator.EQUALS,
        target: '$.data.id',
        expected: '42',
      })
    ).toBe('JSON path $.data.id equals 42');
  });
});
