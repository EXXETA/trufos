import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  listRequestsInOrder,
  listRunnerTreeItems,
  RunResultStatus,
  selectRunSummary,
  useCollectionRunnerStore,
} from './collectionRunnerStore';
import { Folder } from 'shim/objects/folder';
import { RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { RequestMethod } from 'shim/objects/request-method';
import { TrufosResponse } from 'shim/objects/response';

const { sendRequestMock, addResponseMock } = vi.hoisted(() => ({
  sendRequestMock: vi.fn(),
  addResponseMock: vi.fn(),
}));

vi.mock('@/services/http/http-service', () => ({
  HttpService: { instance: { sendRequest: sendRequestMock } },
}));

vi.mock('@/state/responseStore', () => ({
  useResponseStore: { getState: () => ({ addResponse: addResponseMock }) },
}));

const makeRequest = (id: string, parentId = 'collection'): TrufosRequest =>
  ({
    id,
    parentId,
    type: 'request',
    title: id,
    url: { base: 'http://localhost', query: [] },
    method: RequestMethod.GET,
    headers: [],
    body: { type: RequestBodyType.TEXT, mimeType: 'text/plain' },
    draft: false,
  }) as unknown as TrufosRequest;

const makeFolder = (id: string, children: (Folder | TrufosRequest)[]): Folder =>
  ({
    id,
    parentId: 'collection',
    type: 'folder',
    title: id,
    lastModified: Date.now(),
    children,
  }) as Folder;

const makeResponse = (status: number): TrufosResponse => ({
  type: 'response',
  headers: {},
  metaInfo: {
    status,
    duration: 42,
    size: { totalSizeInBytes: 10, headersSizeInBytes: 5, bodySizeInBytes: 5 },
  },
  id: 'response-id',
});

const initialState = useCollectionRunnerStore.getState();

describe('collectionRunnerStore helpers', () => {
  it('listRequestsInOrder flattens the tree depth-first in tree order', () => {
    const tree = [
      makeRequest('r1'),
      makeFolder('f1', [makeRequest('r2', 'f1'), makeFolder('f2', [makeRequest('r3', 'f2')])]),
      makeRequest('r4'),
    ];

    expect(listRequestsInOrder(tree).map(({ id }) => id)).toEqual(['r1', 'r2', 'r3', 'r4']);
  });

  it('listRunnerTreeItems returns folders and requests with their depth', () => {
    const tree = [
      makeRequest('r1'),
      makeFolder('f1', [makeRequest('r2', 'f1'), makeFolder('f2', [makeRequest('r3', 'f2')])]),
    ];

    expect(listRunnerTreeItems(tree).map(({ item, depth }) => [item.id, depth])).toEqual([
      ['r1', 0],
      ['f1', 0],
      ['r2', 1],
      ['f2', 1],
      ['r3', 2],
    ]);
  });
});

describe('collectionRunnerStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCollectionRunnerStore.setState({
      ...initialState,
      deselectedRequestIds: new Set<string>(),
      runOrder: [],
      results: {},
      lastRunDurationMs: undefined,
    });
  });

  it('opens and closes the runner view', () => {
    useCollectionRunnerStore.getState().openRunner();
    expect(useCollectionRunnerStore.getState().isOpen).toBe(true);
    useCollectionRunnerStore.getState().closeRunner();
    expect(useCollectionRunnerStore.getState().isOpen).toBe(false);
  });

  it('toggles request selection and selects/deselects all', () => {
    const { toggleRequestSelection, setAllSelected } = useCollectionRunnerStore.getState();

    toggleRequestSelection('r1');
    expect(useCollectionRunnerStore.getState().deselectedRequestIds.has('r1')).toBe(true);
    toggleRequestSelection('r1');
    expect(useCollectionRunnerStore.getState().deselectedRequestIds.has('r1')).toBe(false);

    setAllSelected(['r1', 'r2'], false);
    expect(useCollectionRunnerStore.getState().deselectedRequestIds).toEqual(new Set(['r1', 'r2']));
    setAllSelected(['r1', 'r2'], true);
    expect(useCollectionRunnerStore.getState().deselectedRequestIds.size).toBe(0);
  });

  it('runs requests sequentially and records passed results', async () => {
    sendRequestMock.mockResolvedValue(makeResponse(200));
    const requests = [makeRequest('r1'), makeRequest('r2')];

    await useCollectionRunnerStore.getState().run(requests);

    expect(sendRequestMock).toHaveBeenCalledTimes(2);
    expect(sendRequestMock.mock.calls.map(([request]) => request.id)).toEqual(['r1', 'r2']);
    expect(addResponseMock).toHaveBeenCalledTimes(2);

    const state = useCollectionRunnerStore.getState();
    expect(state.isRunning).toBe(false);
    expect(state.runOrder).toEqual(['r1', 'r2']);
    expect(state.results['r1'].status).toBe(RunResultStatus.PASSED);
    expect(state.results['r2'].status).toBe(RunResultStatus.PASSED);
    expect(selectRunSummary(state)).toMatchObject({ total: 2, passed: 2, failed: 0, skipped: 0 });
  });

  it('marks responses with an error status code as failed', async () => {
    sendRequestMock
      .mockResolvedValueOnce(makeResponse(200))
      .mockResolvedValueOnce(makeResponse(500));

    await useCollectionRunnerStore.getState().run([makeRequest('r1'), makeRequest('r2')]);

    const state = useCollectionRunnerStore.getState();
    expect(state.results['r1'].status).toBe(RunResultStatus.PASSED);
    expect(state.results['r2'].status).toBe(RunResultStatus.FAILED);
    expect(selectRunSummary(state)).toMatchObject({ total: 2, passed: 1, failed: 1 });
  });

  it('marks a request as failed when sending throws', async () => {
    sendRequestMock.mockRejectedValue(new Error('connection refused'));

    await useCollectionRunnerStore.getState().run([makeRequest('r1')]);

    const result = useCollectionRunnerStore.getState().results['r1'];
    expect(result.status).toBe(RunResultStatus.FAILED);
    expect(result.error).toBe('connection refused');
    expect(addResponseMock).not.toHaveBeenCalled();
  });

  it('skips remaining requests after a failure when stopOnFailure is enabled', async () => {
    useCollectionRunnerStore.getState().setStopOnFailure(true);
    sendRequestMock.mockResolvedValueOnce(makeResponse(404)).mockResolvedValue(makeResponse(200));

    await useCollectionRunnerStore
      .getState()
      .run([makeRequest('r1'), makeRequest('r2'), makeRequest('r3')]);

    expect(sendRequestMock).toHaveBeenCalledTimes(1);
    const state = useCollectionRunnerStore.getState();
    expect(state.results['r1'].status).toBe(RunResultStatus.FAILED);
    expect(state.results['r2'].status).toBe(RunResultStatus.SKIPPED);
    expect(state.results['r3'].status).toBe(RunResultStatus.SKIPPED);
    expect(selectRunSummary(state)).toMatchObject({ passed: 0, failed: 1, skipped: 2 });
  });

  it('excludes deselected requests from the run', async () => {
    sendRequestMock.mockResolvedValue(makeResponse(200));
    useCollectionRunnerStore.getState().toggleRequestSelection('r1');

    await useCollectionRunnerStore.getState().run([makeRequest('r1'), makeRequest('r2')]);

    expect(sendRequestMock).toHaveBeenCalledTimes(1);
    expect(sendRequestMock.mock.calls[0][0].id).toBe('r2');
    expect(useCollectionRunnerStore.getState().runOrder).toEqual(['r2']);
  });

  it('does nothing when all requests are deselected', async () => {
    useCollectionRunnerStore.getState().setAllSelected(['r1'], false);

    await useCollectionRunnerStore.getState().run([makeRequest('r1')]);

    expect(sendRequestMock).not.toHaveBeenCalled();
    expect(useCollectionRunnerStore.getState().runOrder).toEqual([]);
  });

  it('skips remaining requests when the run is cancelled', async () => {
    sendRequestMock.mockImplementation(async () => {
      useCollectionRunnerStore.getState().cancel();
      return makeResponse(200);
    });

    await useCollectionRunnerStore.getState().run([makeRequest('r1'), makeRequest('r2')]);

    expect(sendRequestMock).toHaveBeenCalledTimes(1);
    const state = useCollectionRunnerStore.getState();
    expect(state.results['r1'].status).toBe(RunResultStatus.PASSED);
    expect(state.results['r2'].status).toBe(RunResultStatus.SKIPPED);
    expect(state.cancelRequested).toBe(false);
  });

  it('shares the main-process variable state across requests via sequential execution', async () => {
    // Requests must run strictly one after another so that variables set by a
    // post-response script of request 1 are visible to request 2 in the main process.
    let concurrent = 0;
    let maxConcurrent = 0;
    sendRequestMock.mockImplementation(async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((resolve) => setTimeout(resolve, 1));
      concurrent--;
      return makeResponse(200);
    });

    await useCollectionRunnerStore.getState().run([makeRequest('r1'), makeRequest('r2')]);

    expect(maxConcurrent).toBe(1);
  });
});
