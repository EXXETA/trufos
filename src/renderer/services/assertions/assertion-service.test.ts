import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Assertion, AssertionOperator, AssertionType } from 'shim/objects/assertion';
import { TrufosResponse } from 'shim/objects/response';
import { evaluateAssertions } from './assertion-service';

const readAll = vi.fn<() => Promise<string>>();
const open = vi.fn(() => ({ readAll }));

vi.mock('@/lib/ipc-stream', () => ({
  IpcPushStream: {
    open: () => open(),
  },
}));

const response: TrufosResponse = {
  type: 'response',
  id: 'response-id',
  headers: {
    'content-type': 'application/json',
  },
  metaInfo: {
    duration: 120,
    status: 201,
    size: {
      totalSizeInBytes: 100,
      headersSizeInBytes: 40,
      bodySizeInBytes: 60,
    },
  },
};

describe('evaluateAssertions', () => {
  beforeEach(() => {
    open.mockImplementation(() => ({ readAll }));
    readAll.mockReset();
  });

  it('evaluates status code and response time assertions', async () => {
    const assertions: Assertion[] = [
      {
        id: 'status',
        isActive: true,
        type: AssertionType.STATUS_CODE,
        operator: AssertionOperator.EQUALS,
        expected: '201',
      },
      {
        id: 'time',
        isActive: true,
        type: AssertionType.RESPONSE_TIME,
        operator: AssertionOperator.BELOW,
        expected: '100',
      },
    ];

    await expect(evaluateAssertions(assertions, response)).resolves.toEqual([
      { assertionId: 'status', name: 'Status code equals 201', passed: true, message: 'Passed' },
      {
        assertionId: 'time',
        name: 'Response time below 100 ms',
        passed: false,
        message: 'Expected below 100ms, got 120ms',
      },
    ]);
  });

  it('evaluates header assertions case-insensitively', async () => {
    const assertions: Assertion[] = [
      {
        id: 'header',
        isActive: true,
        type: AssertionType.HEADER,
        operator: AssertionOperator.CONTAINS,
        target: 'Content-Type',
        expected: 'json',
      },
    ];

    await expect(evaluateAssertions(assertions, response)).resolves.toEqual([
      {
        assertionId: 'header',
        name: 'Header Content-Type contains json',
        passed: true,
        message: 'Passed',
      },
    ]);
  });

  it('evaluates JSON path assertions against response body', async () => {
    readAll.mockResolvedValueOnce('{"data":{"id":42}}');
    const assertions: Assertion[] = [
      {
        id: 'json',
        isActive: true,
        type: AssertionType.JSON_PATH,
        operator: AssertionOperator.EQUALS,
        target: '$.data.id',
        expected: '42',
      },
    ];

    await expect(evaluateAssertions(assertions, response)).resolves.toEqual([
      {
        assertionId: 'json',
        name: 'JSON path $.data.id equals 42',
        passed: true,
        message: 'Passed',
      },
    ]);
  });

  it('reports JSON path assertions as failed when response body is not JSON', async () => {
    readAll.mockResolvedValueOnce('not json');
    const assertions: Assertion[] = [
      {
        id: 'json',
        isActive: true,
        type: AssertionType.JSON_PATH,
        operator: AssertionOperator.EXISTS,
        target: '$.data.id',
      },
    ];

    await expect(evaluateAssertions(assertions, response)).resolves.toEqual([
      {
        assertionId: 'json',
        name: 'JSON path $.data.id exists',
        passed: false,
        message: 'Response body is not valid JSON',
      },
    ]);
  });

  it('reports a read failure separately from invalid JSON', async () => {
    open.mockRejectedValueOnce(new Error('stream failed'));
    const assertions: Assertion[] = [
      {
        id: 'json',
        isActive: true,
        type: AssertionType.JSON_PATH,
        operator: AssertionOperator.EXISTS,
        target: '$.data.id',
      },
    ];

    await expect(evaluateAssertions(assertions, response)).resolves.toEqual([
      {
        assertionId: 'json',
        name: 'JSON path $.data.id exists',
        passed: false,
        message: 'Response body could not be read',
      },
    ]);
  });
});
