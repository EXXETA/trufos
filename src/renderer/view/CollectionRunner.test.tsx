import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CollectionRunner } from './CollectionRunner';
import { RequestMethod } from 'shim/objects/request-method';
import type { Folder } from 'shim/objects/folder';
import { RequestBodyType, type TrufosRequest } from 'shim/objects/request';
import type { TrufosResponse } from 'shim/objects/response';

const sendRequestMock =
  vi.fn<(request: TrufosRequest, abortKey?: string) => Promise<TrufosResponse>>();
const abortRequestMock = vi.fn().mockResolvedValue(undefined);
const addResponseMock = vi.fn();
const showErrorMock = vi.fn();

vi.mock('@/services/http/http-service', () => ({
  HttpService: {
    instance: {
      sendRequest: (request: TrufosRequest, abortKey?: string) =>
        sendRequestMock(request, abortKey),
      abortRequest: (abortKey: string) => abortRequestMock(abortKey),
    },
  },
}));

vi.mock('@/state/responseStore', () => ({
  useResponseActions: () => ({ addResponse: addResponseMock }),
}));

vi.mock('@/lib/monaco/models', () => ({
  saveModelContent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('monaco-editor', () => ({
  editor: { getModels: () => [] },
}));

vi.mock('@/components/mainWindow/bodyTabs/OutputTabs/PrettyRenderer', () => ({
  useResponseData: vi.fn(),
}));

vi.mock('@/error/errorHandler', () => ({
  showError: (...args: unknown[]) => showErrorMock(...args),
}));

interface MockEnvironmentState {
  environments: Record<string, { variables: Record<string, unknown> }>;
  selectedEnvironment?: string;
}

let mockEnvironmentState: MockEnvironmentState;
const selectEnvironmentMock = vi.fn();

vi.mock('@/state/environmentStore', () => ({
  useEnvironmentStore: <T,>(selector: (state: MockEnvironmentState) => T) =>
    selector(mockEnvironmentState),
  selectEnvironments: (state: MockEnvironmentState) => state.environments,
  selectSelectedEnvironment: (state: MockEnvironmentState) => state.selectedEnvironment,
  useEnvironmentActions: () => ({ selectEnvironment: selectEnvironmentMock }),
}));

interface MockState {
  collection: { id: string; title: string; children: Array<Folder | TrufosRequest> };
  requests: Map<string, TrufosRequest>;
  folders: Map<string, Folder>;
}

let mockState: MockState;

vi.mock('@/state/collectionStore', () => ({
  useCollectionStore: <T,>(selector: (state: MockState) => T) => selector(mockState),
}));

function makeRequest(
  id: string,
  title: string,
  method: RequestMethod = RequestMethod.GET,
  parentId = 'col-1'
): TrufosRequest {
  return {
    id,
    parentId,
    type: 'request',
    lastModified: 0,
    title,
    url: { base: `https://example.com/${id}`, query: [] },
    method,
    headers: [],
    body: { type: RequestBodyType.TEXT, mimeType: 'text/plain' },
  };
}

function makeFolder(id: string, title: string, children: Array<Folder | TrufosRequest>): Folder {
  return { id, parentId: 'col-1', type: 'folder', lastModified: 0, title, children };
}

function makeResponse(status: number, duration = 100): TrufosResponse {
  return {
    type: 'response',
    id: `response-${status}-${Math.random()}`,
    headers: { 'content-type': 'application/json' },
    metaInfo: {
      status,
      duration,
      size: { totalSizeInBytes: 10, headersSizeInBytes: 5, bodySizeInBytes: 5 },
    },
  };
}

function setupCollection(children: Array<Folder | TrufosRequest>) {
  const requests = new Map<string, TrufosRequest>();
  const folders = new Map<string, Folder>();
  const walk = (items: Array<Folder | TrufosRequest>) => {
    for (const item of items) {
      if (item.type === 'request') requests.set(item.id, item);
      else {
        folders.set(item.id, item);
        walk(item.children);
      }
    }
  };
  walk(children);
  mockState = { collection: { id: 'col-1', title: 'My Collection', children }, requests, folders };
}

function renderRunner(props: Partial<Parameters<typeof CollectionRunner>[0]> = {}) {
  return render(<CollectionRunner open onClose={vi.fn()} {...props} />);
}

/** Creates a promise that can be resolved/rejected from the outside. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  sendRequestMock.mockReset();
  abortRequestMock.mockClear();
  addResponseMock.mockClear();
  showErrorMock.mockClear();
  selectEnvironmentMock.mockClear();
  mockEnvironmentState = {
    environments: { dev: { variables: {} }, prod: { variables: {} } },
    selectedEnvironment: 'dev',
  };
  setupCollection([
    makeRequest('req-1', 'Login', RequestMethod.POST),
    makeFolder('folder-1', 'Orders', [
      makeRequest('req-2', 'List Orders', RequestMethod.GET, 'folder-1'),
      makeRequest('req-3', 'Create Order', RequestMethod.POST, 'folder-1'),
    ]),
    makeRequest('req-4', 'Logout', RequestMethod.POST),
  ]);
});

describe('CollectionRunner rendering', () => {
  it('renders nothing when closed', () => {
    renderRunner({ open: false });

    expect(screen.queryByText('Collection Runner')).toBeNull();
  });

  it('shows the collection title and all requests when open', () => {
    renderRunner();

    expect(screen.getByText('Collection Runner')).toBeDefined();
    expect(screen.getByText('My Collection')).toBeDefined();
    // Requests appear in the checklist and in the results table.
    expect(screen.getAllByText('Login')).toHaveLength(2);
    expect(screen.getAllByText('List Orders')).toHaveLength(2);
    expect(screen.getAllByText('Create Order')).toHaveLength(2);
    expect(screen.getAllByText('Logout')).toHaveLength(2);
  });

  it('shows folders with their request count in the checklist', () => {
    renderRunner();

    expect(screen.getByText('Orders')).toBeDefined();
    const folderRow = screen.getByText('Orders').closest('label')!;
    expect(within(folderRow).getByText('2')).toBeDefined();
  });

  it('selects all requests by default and shows the count on the run button', () => {
    renderRunner();

    expect(screen.getByRole('button', { name: /run 4 requests/i })).toBeDefined();
    expect(screen.getAllByText('Pending')).toHaveLength(4);
  });

  it('uses the singular label when only one request is selected', async () => {
    const user = userEvent.setup();
    renderRunner();

    await user.click(screen.getByText('None'));
    const loginRow = screen.getAllByText('Login')[0].closest('label')!;
    await user.click(within(loginRow).getByRole('checkbox'));

    expect(screen.getByRole('button', { name: /run 1 request$/i })).toBeDefined();
  });
});

describe('CollectionRunner selection', () => {
  it('deselects all requests via None and disables the run button', async () => {
    const user = userEvent.setup();
    renderRunner();

    await user.click(screen.getByText('None'));

    const runButton = screen.getByRole('button', { name: /run 0 requests/i });
    expect(runButton.hasAttribute('disabled')).toBe(true);
  });

  it('re-selects all requests via All', async () => {
    const user = userEvent.setup();
    renderRunner();

    await user.click(screen.getByText('None'));
    await user.click(screen.getByText('All'));

    expect(screen.getByRole('button', { name: /run 4 requests/i })).toBeDefined();
  });

  it('toggles all requests of a folder via the folder checkbox', async () => {
    const user = userEvent.setup();
    renderRunner();

    const folderRow = screen.getByText('Orders').closest('label')!;
    await user.click(within(folderRow).getByRole('checkbox'));

    expect(screen.getByRole('button', { name: /run 2 requests/i })).toBeDefined();
  });

  it('keeps the selection when a new request is added and auto-selects it', () => {
    const { rerender } = renderRunner();

    setupCollection([
      ...mockState.collection.children,
      makeRequest('req-5', 'New Request', RequestMethod.PUT),
    ]);
    rerender(<CollectionRunner open onClose={vi.fn()} />);

    expect(screen.getByRole('button', { name: /run 5 requests/i })).toBeDefined();
  });

  it('prunes removed requests from the selection', () => {
    const { rerender } = renderRunner();

    setupCollection([makeRequest('req-1', 'Login', RequestMethod.POST)]);
    rerender(<CollectionRunner open onClose={vi.fn()} />);

    expect(screen.getByRole('button', { name: /run 1 request$/i })).toBeDefined();
  });
});

describe('CollectionRunner execution', () => {
  it('runs all selected requests in collection order and reports passed results', async () => {
    const user = userEvent.setup();
    sendRequestMock.mockResolvedValue(makeResponse(200));
    renderRunner();

    await user.click(screen.getByRole('button', { name: /run 4 requests/i }));

    await waitFor(() => expect(screen.getAllByText('Passed')).toHaveLength(4));
    expect(sendRequestMock).toHaveBeenCalledTimes(4);
    expect(sendRequestMock.mock.calls.map(([request]) => request.id)).toEqual([
      'req-1',
      'req-2',
      'req-3',
      'req-4',
    ]);
  });

  it('stores each response in the response store', async () => {
    const user = userEvent.setup();
    sendRequestMock.mockResolvedValue(makeResponse(200));
    renderRunner();

    await user.click(screen.getByRole('button', { name: /run 4 requests/i }));

    await waitFor(() => expect(addResponseMock).toHaveBeenCalledTimes(4));
    expect(addResponseMock.mock.calls.map(([requestId]) => requestId)).toEqual([
      'req-1',
      'req-2',
      'req-3',
      'req-4',
    ]);
  });

  it('marks non-successful status codes as failed and shows the summary', async () => {
    const user = userEvent.setup();
    sendRequestMock
      .mockResolvedValueOnce(makeResponse(200))
      .mockResolvedValueOnce(makeResponse(404))
      .mockResolvedValueOnce(makeResponse(500))
      .mockResolvedValueOnce(makeResponse(302));
    renderRunner();

    await user.click(screen.getByRole('button', { name: /run 4 requests/i }));

    await waitFor(() => expect(screen.getAllByText('Failed')).toHaveLength(2));
    expect(screen.getAllByText('Passed')).toHaveLength(2);
    const passedTile = screen.getByText('passed').closest('div')!;
    expect(within(passedTile).getByText('2')).toBeDefined();
    const failedTile = screen.getByText('failed').closest('div')!;
    expect(within(failedTile).getByText('2')).toBeDefined();
  });

  it('marks a request as failed when sending throws', async () => {
    const user = userEvent.setup();
    sendRequestMock
      .mockResolvedValueOnce(makeResponse(200))
      .mockRejectedValueOnce(new Error('connection refused'))
      .mockResolvedValue(makeResponse(200));
    renderRunner();

    await user.click(screen.getByRole('button', { name: /run 4 requests/i }));

    await waitFor(() => expect(screen.getAllByText('Failed')).toHaveLength(1));
    expect(screen.getAllByText('Passed')).toHaveLength(3);
    expect(sendRequestMock).toHaveBeenCalledTimes(4);
  });

  it('only runs the selected requests', async () => {
    const user = userEvent.setup();
    sendRequestMock.mockResolvedValue(makeResponse(200));
    renderRunner();

    const folderRow = screen.getByText('Orders').closest('label')!;
    await user.click(within(folderRow).getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /run 2 requests/i }));

    await waitFor(() => expect(screen.getAllByText('Passed')).toHaveLength(2));
    expect(sendRequestMock.mock.calls.map(([request]) => request.id)).toEqual(['req-1', 'req-4']);
  });

  it('stops after the first failure when the toggle is active', async () => {
    const user = userEvent.setup();
    sendRequestMock.mockResolvedValueOnce(makeResponse(500)).mockResolvedValue(makeResponse(200));
    renderRunner();

    await user.click(screen.getByText('Stop on first failure'));
    await user.click(screen.getByRole('button', { name: /run 4 requests/i }));

    await waitFor(() => expect(screen.getAllByText('Failed')).toHaveLength(1));
    expect(sendRequestMock).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText('Pending')).toHaveLength(3);
  });

  it('continues after failures when the toggle is inactive', async () => {
    const user = userEvent.setup();
    sendRequestMock.mockResolvedValue(makeResponse(500));
    renderRunner();

    await user.click(screen.getByRole('button', { name: /run 4 requests/i }));

    await waitFor(() => expect(sendRequestMock).toHaveBeenCalledTimes(4));
    await waitFor(() => expect(screen.getAllByText('Failed')).toHaveLength(4));
  });

  it('shows the running state and disables controls during a run', async () => {
    const user = userEvent.setup();
    const first = deferred<TrufosResponse>();
    sendRequestMock.mockReturnValueOnce(first.promise);
    renderRunner();

    await user.click(screen.getByRole('button', { name: /run 4 requests/i }));

    // "Running" appears twice: as the result pill and as the run button label.
    expect(screen.getAllByText('Running')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /stop/i })).toBeDefined();
    expect(screen.getByText('0 / 4 done')).toBeDefined();
    for (const checkbox of screen.getAllByRole('checkbox')) {
      expect(checkbox.hasAttribute('disabled')).toBe(true);
    }

    sendRequestMock.mockResolvedValue(makeResponse(200));
    first.resolve(makeResponse(200));
    await waitFor(() => expect(screen.getAllByText('Passed')).toHaveLength(4));
  });

  it('aborts the run when Stop is clicked', async () => {
    const user = userEvent.setup();
    const first = deferred<TrufosResponse>();
    sendRequestMock.mockReturnValueOnce(first.promise);
    renderRunner();

    await user.click(screen.getByRole('button', { name: /run 4 requests/i }));
    await user.click(screen.getByRole('button', { name: /stop/i }));

    first.resolve(makeResponse(200));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /run 4 requests/i })).toBeDefined()
    );
    // Only the first request was sent; the rest of the run is aborted.
    expect(sendRequestMock).toHaveBeenCalledTimes(1);
    expect(abortRequestMock).toHaveBeenCalledWith(sendRequestMock.mock.calls[0][1]);
    expect(screen.queryAllByText('Passed')).toHaveLength(0);
  });

  it('resets previous results when a new run starts', async () => {
    const user = userEvent.setup();
    sendRequestMock.mockResolvedValue(makeResponse(500));
    renderRunner();

    await user.click(screen.getByRole('button', { name: /run 4 requests/i }));
    await waitFor(() => expect(screen.getAllByText('Failed')).toHaveLength(4));

    sendRequestMock.mockResolvedValue(makeResponse(200));
    await user.click(screen.getByRole('button', { name: /run 4 requests/i }));

    await waitFor(() => expect(screen.getAllByText('Passed')).toHaveLength(4));
    expect(screen.queryAllByText('Failed')).toHaveLength(0);
  });
});

describe('CollectionRunner result details', () => {
  it('shows the status code and duration in the result row', async () => {
    const user = userEvent.setup();
    sendRequestMock.mockResolvedValue(makeResponse(201, 42));
    renderRunner();

    await user.click(screen.getByRole('button', { name: /run 4 requests/i }));

    await waitFor(() => expect(screen.getAllByText('201')).toHaveLength(4));
    expect(screen.getAllByText('42 ms')).toHaveLength(4);
  });

  it('shows the error message when a row of a failed request is expanded', async () => {
    const user = userEvent.setup();
    sendRequestMock.mockRejectedValue(new Error('connection refused'));
    renderRunner();

    await user.click(screen.getByRole('button', { name: /run 4 requests/i }));
    await waitFor(() => expect(screen.getAllByText('Failed')).toHaveLength(4));

    const row = screen
      .getAllByRole('button')
      .find((button) => button.textContent?.includes('Login'))!;
    await user.click(row);

    expect(screen.getByText('connection refused')).toBeDefined();
  });

  it('shows response details with body and headers tabs when a row is expanded', async () => {
    const user = userEvent.setup();
    sendRequestMock.mockResolvedValue(makeResponse(200, 1234));
    renderRunner();

    await user.click(screen.getByRole('button', { name: /run 4 requests/i }));
    await waitFor(() => expect(screen.getAllByText('Passed')).toHaveLength(4));

    const row = screen
      .getAllByRole('button')
      .find((button) => button.textContent?.includes('Login'))!;
    await user.click(row);

    expect(screen.getByText('Status:')).toBeDefined();
    expect(screen.getByText('Duration:')).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Headers' }));
    expect(screen.getByText(/content-type/)).toBeDefined();
  });

  it('shows the total duration in the summary after a run', async () => {
    const user = userEvent.setup();
    sendRequestMock.mockResolvedValue(makeResponse(200));
    renderRunner();

    await user.click(screen.getByRole('button', { name: /run 4 requests/i }));

    await waitFor(() => expect(screen.getAllByText('Passed')).toHaveLength(4));
    expect(screen.getByText(/^Elapsed /).textContent).not.toContain('-');
  });
});

describe('CollectionRunner environment selection', () => {
  it('shows the currently selected environment', () => {
    renderRunner();

    const dropdown = screen.getByRole('combobox', { name: /select environment/i });
    expect(within(dropdown).getByText('dev')).toBeDefined();
  });

  it('shows a placeholder when no environment is selected', () => {
    mockEnvironmentState.selectedEnvironment = undefined;
    renderRunner();

    const dropdown = screen.getByRole('combobox', { name: /select environment/i });
    expect(within(dropdown).getByText('No environment')).toBeDefined();
  });

  it('lists all environments and switches on selection', async () => {
    const user = userEvent.setup();
    renderRunner();

    await user.click(screen.getByRole('combobox', { name: /select environment/i }));
    await user.click(await screen.findByRole('option', { name: 'prod' }));

    expect(selectEnvironmentMock).toHaveBeenCalledWith('prod');
  });

  it('switches to no environment via the sentinel option', async () => {
    const user = userEvent.setup();
    renderRunner();

    await user.click(screen.getByRole('combobox', { name: /select environment/i }));
    await user.click(await screen.findByRole('option', { name: 'No environment' }));

    expect(selectEnvironmentMock).toHaveBeenCalledWith(undefined);
  });

  it('disables environment switching during a run', async () => {
    const user = userEvent.setup();
    const first = deferred<TrufosResponse>();
    sendRequestMock.mockReturnValueOnce(first.promise);
    renderRunner();

    await user.click(screen.getByRole('button', { name: /run 4 requests/i }));

    const dropdown = screen.getByRole('combobox', { name: /select environment/i });
    expect(dropdown.hasAttribute('disabled')).toBe(true);

    sendRequestMock.mockResolvedValue(makeResponse(200));
    first.resolve(makeResponse(200));
    await waitFor(() => expect(screen.getAllByText('Passed')).toHaveLength(4));
  });
});

describe('CollectionRunner closing', () => {
  it('calls onClose when the close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderRunner({ onClose });

    await user.click(screen.getByRole('button', { name: /close/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape is pressed', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderRunner({ onClose });

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('aborts a run in progress when the modal is closed', async () => {
    const user = userEvent.setup();
    const first = deferred<TrufosResponse>();
    sendRequestMock.mockReturnValueOnce(first.promise);
    const { rerender } = renderRunner();

    await user.click(screen.getByRole('button', { name: /run 4 requests/i }));
    rerender(<CollectionRunner open={false} onClose={vi.fn()} />);

    first.resolve(makeResponse(200));
    await waitFor(() => expect(sendRequestMock).toHaveBeenCalledTimes(1));
    expect(abortRequestMock).toHaveBeenCalledWith(sendRequestMock.mock.calls[0][1]);
    expect(addResponseMock).not.toHaveBeenCalled();
  });
});
