import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HistoryEntry, HistoryEntrySummary } from 'shim/history';
import { RequestMethod } from 'shim/objects/request-method';

const { getHistoryEntryMock } = vi.hoisted(() => ({
  getHistoryEntryMock: vi.fn<(id: string) => Promise<HistoryEntry | undefined>>(),
}));

vi.mock('@/services/event/renderer-event-service', () => ({
  RendererEventService: {
    instance: {
      getHistoryEntry: (id: string) => getHistoryEntryMock(id),
    },
  },
}));

import { HistoryList } from './HistoryList';
import { useHistoryStore } from '@/state/historyStore';
import { getDateTimeText } from '@/util/format-util';

const renderList = () => render(<HistoryList />);

const sent: HistoryEntrySummary = {
  id: 'sent',
  requestId: 'request-1',
  requestTitle: 'Create User',
  timestamp: 0,
  method: RequestMethod.POST,
  url: 'https://example.com/users',
  outcome: { type: 'response', status: 201, duration: 12 },
};

const failed: HistoryEntrySummary = {
  id: 'failed',
  requestId: 'request-2',
  requestTitle: 'Get Orders',
  timestamp: 0,
  method: RequestMethod.GET,
  url: 'https://unreachable.example.com/orders',
  outcome: { type: 'error', message: 'connect ECONNREFUSED' },
};

describe('HistoryList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useHistoryStore.setState({
      entries: [sent, failed],
      selectedId: undefined,
      selectedEntry: undefined,
    });
  });

  it('should list the requests with their status or error', async () => {
    renderList();

    const list = await screen.findByRole('list', { name: 'Request history' });
    const items = within(list).getAllByRole('button');
    expect(items).toHaveLength(2);
    within(items[0]).getByText('Create User');
    within(items[0]).getByText('https://example.com/users');
    within(items[0]).getByText('201');
    within(items[1]).getByText('connect ECONNREFUSED');
  });

  it('should show an empty state', async () => {
    useHistoryStore.setState({ entries: [] });

    renderList();

    await screen.findByText('No requests sent yet.');
  });

  it('should show the date and time a request was sent', async () => {
    renderList();

    const item = await screen.findByRole('button', { name: /Create User/ });
    within(item).getByText(getDateTimeText(0));
  });

  it('should select an entry when it is clicked', async () => {
    getHistoryEntryMock.mockResolvedValue(undefined);
    renderList();

    const item = await screen.findByRole('button', { name: /Create User/ });
    await userEvent.click(item);

    expect(getHistoryEntryMock).toHaveBeenCalledWith('sent');
    expect(useHistoryStore.getState().selectedId).toBe('sent');
    expect(item.getAttribute('aria-current')).toBe('true');
  });
});
