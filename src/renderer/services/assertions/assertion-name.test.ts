import { describe, expect, it } from 'vitest';
import { Assertion, AssertionOperator, AssertionType } from 'shim/objects/assertion';
import { buildAssertionName, withUpdatedAssertionName } from './assertion-name';

const assertion: Assertion = {
  id: 'assertion-id',
  name: 'Status code equals 200',
  isActive: true,
  type: AssertionType.STATUS_CODE,
  operator: AssertionOperator.EQUALS,
  expected: '200',
};

describe('assertion names', () => {
  it('builds names from assertion values', () => {
    expect(buildAssertionName(assertion)).toBe('Status code equals 200');
    expect(
      buildAssertionName({
        type: AssertionType.HEADER,
        operator: AssertionOperator.PRESENT,
        target: 'content-type',
      })
    ).toBe('Header content-type exists');
  });

  it('updates generated names when assertion fields change', () => {
    expect(withUpdatedAssertionName(assertion, { expected: '201' })).toEqual({
      expected: '201',
      name: 'Status code equals 201',
    });
  });

  it('keeps manual names when assertion fields change', () => {
    expect(
      withUpdatedAssertionName(
        {
          ...assertion,
          name: 'My check',
          nameManuallyEdited: true,
        },
        { expected: '201' }
      )
    ).toEqual({ expected: '201' });
  });
});
