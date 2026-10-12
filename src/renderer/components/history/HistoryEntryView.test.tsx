import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HistoryEntry } from 'shim/history';
import { RequestMethod } from 'shim/objects/request-method';
import { ScriptType } from 'shim/scripting';
import type { ReceivedResponse, StoredBody } from 'shim/objects/response';

const { requests, setSelectedRequestMock, disposeMock } = vi.hoisted(() => ({
  requests: new Map<string, unknown>(),
  setSelectedRequestMock: vi.fn(),
  disposeMock: vi.fn(),
}));

vi.mock('@/state/collectionStore', () => ({
  useCollectionStore: (selector: (state: { requests: Map<string, unknown> }) => unknown) =>
    selector({ requests }),
  useCollectionActions: () => ({ setSelectedRequest: setSelectedRequestMock }),
}));

vi.mock('monaco-editor', () => ({
  editor: { createModel: () => ({ dispose: disposeMock }) },
}));

vi.mock('@/components/mainWindow/bodyTabs/OutputTabs/BodyTab', () => ({
  BodyTab: ({ body }: { body?: StoredBody }) => <div>body {body?.id}</div>,
}));

vi.mock('@/components/mainWindow/bodyTabs/OutputTabs', () => ({
  ResponseTabs: ({ response }: { response: ReceivedResponse }) => (
    <div>
      response {response.metaInfo.status} body {response.body?.id}
    </div>
  ),
}));

import { HistoryEntryView } from './HistoryEntryView';
import { useHistoryStore } from '@/state/historyStore';
import { useViewStore } from '@/state/viewStore';

const entry: HistoryEntry = {
  id: 'sent',
  requestId: 'request-1',
  requestTitle: 'Create User',
  timestamp: 0,
  method: RequestMethod.POST,
  url: 'https://example.com/users?role=admin&tag=a%20b',
  request: {
    method: 'POST',
    url: 'https://example.com/users?role=admin&tag=a%20b',
    headers: { authorization: 'Bearer secret', 'x-multi': ['a', 'b'] },
    body: { id: 'request-body', size: 14 },
  },
  outcome: {
    type: 'response',
    response: {
      headers: { 'content-type': 'application/json' },
      metaInfo: {
        status: 201,
        duration: 12,
        size: { totalSizeInBytes: 20, headersSizeInBytes: 10, bodySizeInBytes: 10 },
      },
      body: { id: 'response-body', size: 10 },
    },
  },
  scriptLogs: [
    { script: ScriptType.PRE_REQUEST, level: 'info', args: ['token is', { value: 'abc' }] },
  ],
};

function showEntry(shown: HistoryEntry) {
  useHistoryStore.setState({ selectedId: shown.id, selectedEntry: shown });
  return render(<HistoryEntryView />);
}

describe('HistoryEntryView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requests.clear();
    useViewStore.setState({ sidebarView: 'history' });
  });

  it('should show a loading state until the entry is loaded', () => {
    useHistoryStore.setState({ selectedId: 'sent', selectedEntry: undefined });

    render(<HistoryEntryView />);

    screen.getByText('Loading…');
  });

  it('should show the sent method, URL and request body', () => {
    showEntry(entry);

    screen.getByText('POST');
    expect(screen.getByLabelText('URL').textContent).toBe(entry.url);
    screen.getByText('body request-body');
  });

  it('should show the sent query parameters and unredacted headers', async () => {
    showEntry(entry);

    await userEvent.click(screen.getByRole('tab', { name: 'Parameters (2)' }));
    const params = screen.getByRole('table', { name: 'Query parameters' });
    expect(params.textContent).toContain('role');
    expect(params.textContent).toContain('a b');

    await userEvent.click(screen.getByRole('tab', { name: 'Headers (2)' }));
    const headers = screen.getByRole('table', { name: 'Request headers' });
    expect(headers.textContent).toContain('Bearer secret');
    expect(headers.textContent).toContain('a, b');
  });

  it('should show the script output in the console tab', async () => {
    showEntry(entry);

    await userEvent.click(screen.getByRole('tab', { name: 'Console (1)' }));

    screen.getByText(/token is \{\s*"value": "abc"\s*\}/);
  });

  it('should show the received response', () => {
    showEntry(entry);

    screen.getByText('response 201 body response-body');
  });

  it('should show the error of a request that was not sent', () => {
    showEntry({
      ...entry,
      request: undefined,
      outcome: { type: 'error', message: 'Variable "token" is not defined' },
      scriptLogs: [],
    });

    screen.getByText('The request was not sent.');
    screen.getByText('Variable "token" is not defined');
  });

  it('should go to the request it was sent from', async () => {
    requests.set('request-1', {});
    showEntry(entry);

    await userEvent.click(screen.getByRole('button', { name: 'Go to request' }));

    expect(setSelectedRequestMock).toHaveBeenCalledWith('request-1');
    expect(useViewStore.getState().sidebarView).toBe('requests');
  });

  it('should not go to a request that no longer exists', () => {
    showEntry(entry);

    expect(screen.getByRole('button', { name: 'Go to request' })).toHaveProperty('disabled', true);
  });

  it('should close the entry', async () => {
    showEntry(entry);

    await userEvent.click(screen.getByRole('button', { name: 'Close history entry' }));

    expect(useHistoryStore.getState().selectedId).toBeUndefined();
  });

  it('should dispose the models of the request and response bodies when it is closed', () => {
    const { unmount } = showEntry(entry);

    unmount();

    expect(disposeMock).toHaveBeenCalledTimes(2);
  });
});
