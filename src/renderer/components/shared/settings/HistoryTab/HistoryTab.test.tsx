import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HistoryEntry, HistoryEntrySummary } from 'shim/history';
import { RequestMethod } from 'shim/objects/request-method';
import { ScriptType } from 'shim/scripting';

const { getHistoryMock, getHistoryEntryMock, clearHistoryMock } = vi.hoisted(() => ({
  getHistoryMock: vi.fn<() => Promise<HistoryEntrySummary[]>>(),
  getHistoryEntryMock: vi.fn<(id: string) => Promise<HistoryEntry | undefined>>(),
  clearHistoryMock: vi.fn<() => Promise<void>>(),
}));

vi.mock('@/services/event/renderer-event-service', () => ({
  RendererEventService: {
    instance: {
      getHistory: () => getHistoryMock(),
      getHistoryEntry: (id: string) => getHistoryEntryMock(id),
      clearHistory: () => clearHistoryMock(),
    },
  },
}));

vi.mock('./HistoryBodyViewer', () => ({
  HistoryBodyViewer: ({ body }: { body: { id: string } }) => <div>body {body.id}</div>,
}));

import { HistoryTab } from './HistoryTab';
import { useHistoryStore } from '@/state/historyStore';

const sent: HistoryEntrySummary = {
  id: 'sent',
  requestId: 'request-1',
  requestTitle: 'Create User',
  timestamp: 0,
  method: RequestMethod.POST,
  url: 'https://example.com/users',
  status: 201,
  duration: 12,
};

const failed: HistoryEntrySummary = {
  id: 'failed',
  requestId: 'request-2',
  requestTitle: 'Get Orders',
  timestamp: 0,
  method: RequestMethod.GET,
  url: 'https://unreachable.example.com/orders',
  error: 'connect ECONNREFUSED',
};

const sentEntry: HistoryEntry = {
  ...sent,
  request: {
    method: 'POST',
    url: sent.url,
    headers: { authorization: 'Bearer secret', 'x-multi': ['a', 'b'] },
    body: { id: 'request-body', size: 14 },
  },
  response: {
    headers: { 'content-type': 'application/json' },
    metaInfo: {
      status: 201,
      duration: 12,
      size: { totalSizeInBytes: 20, headersSizeInBytes: 10, bodySizeInBytes: 10 },
    },
    body: { id: 'response-body', size: 10 },
  },
  scriptLogs: [
    { script: ScriptType.PRE_REQUEST, level: 'info', args: ['token is', { value: 'abc' }] },
  ],
};

describe('HistoryTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useHistoryStore.setState({ entries: [], selectedId: undefined, selectedEntry: undefined });
    getHistoryMock.mockResolvedValue([sent, failed]);
  });

  it('should list the requests with their status or error', async () => {
    render(<HistoryTab />);

    const list = await screen.findByRole('list', { name: 'Request history' });
    const items = within(list).getAllByRole('button');
    expect(items).toHaveLength(2);
    within(items[0]).getByText('Create User');
    within(items[0]).getByText('201');
    within(items[1]).getByText('connect ECONNREFUSED');
  });

  it('should show an empty state', async () => {
    getHistoryMock.mockResolvedValue([]);

    render(<HistoryTab />);

    await screen.findByText('No requests sent yet.');
    expect(screen.getByRole('button', { name: 'Clear' })).toHaveProperty('disabled', true);
  });

  it('should show the sent request with its unredacted headers when selected', async () => {
    getHistoryEntryMock.mockResolvedValue(sentEntry);
    render(<HistoryTab />);

    await userEvent.click(await screen.findByRole('button', { name: /Create User/ }));

    await screen.findByText('Bearer secret');
    screen.getByText('a');
    screen.getByText('b');
    screen.getByText('body request-body');
  });

  it('should show the response and the script output in their tabs', async () => {
    getHistoryEntryMock.mockResolvedValue(sentEntry);
    render(<HistoryTab />);
    await userEvent.click(await screen.findByRole('button', { name: /Create User/ }));

    await userEvent.click(await screen.findByRole('tab', { name: 'Response' }));
    screen.getByText('application/json');
    screen.getByText('body response-body');

    await userEvent.click(screen.getByRole('tab', { name: 'Scripts (1)' }));
    screen.getByText(/token is \{\s*"value": "abc"\s*\}/);
  });

  it('should show the error of a failed request', async () => {
    getHistoryEntryMock.mockResolvedValue({ ...failed, scriptLogs: [] });
    render(<HistoryTab />);
    await userEvent.click(await screen.findByRole('button', { name: /Get Orders/ }));

    await screen.findByText('The request was not sent.');
    await userEvent.click(screen.getByRole('tab', { name: 'Response' }));
    expect(screen.getAllByText('connect ECONNREFUSED').length).toBeGreaterThan(0);
  });

  it('should clear the history', async () => {
    clearHistoryMock.mockResolvedValue();
    render(<HistoryTab />);

    await userEvent.click(await screen.findByRole('button', { name: 'Clear' }));

    expect(clearHistoryMock).toHaveBeenCalledOnce();
  });
});
