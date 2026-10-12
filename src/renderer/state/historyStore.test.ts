import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HistoryEntry, HistoryEntrySummary } from 'shim/history';
import { RequestMethod } from 'shim/objects/request-method';

const { getHistoryMock, getHistoryEntryMock, clearHistoryMock, showErrorMock } = vi.hoisted(() => ({
  getHistoryMock: vi.fn<() => Promise<HistoryEntrySummary[]>>(),
  getHistoryEntryMock: vi.fn<(id: string) => Promise<HistoryEntry | undefined>>(),
  clearHistoryMock: vi.fn<() => Promise<void>>(),
  showErrorMock: vi.fn(),
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

vi.mock('@/error/errorHandler', () => ({
  showError: (message: string, error: unknown) => showErrorMock(message, error),
}));

import { useHistoryStore } from './historyStore';

function summary(id: string): HistoryEntrySummary {
  return {
    id,
    requestId: 'request',
    requestTitle: 'Get Users',
    timestamp: 0,
    method: RequestMethod.GET,
    url: 'https://example.com',
    outcome: { type: 'response', status: 200, duration: 1 },
  };
}

function entry(id: string): HistoryEntry {
  const { requestId, requestTitle, timestamp, method, url } = summary(id);
  return {
    id,
    requestId,
    requestTitle,
    timestamp,
    method,
    url,
    outcome: { type: 'error', message: 'failed' },
    scriptLogs: [],
  };
}

describe('historyStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useHistoryStore.setState({ entries: [], selectedId: undefined, selectedEntry: undefined });
  });

  it('should load the entries', async () => {
    getHistoryMock.mockResolvedValue([summary('a'), summary('b')]);

    await useHistoryStore.getState().load();

    expect(useHistoryStore.getState().entries.map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('should drop the selection if the selected entry is gone', async () => {
    useHistoryStore.setState({ selectedId: 'gone', selectedEntry: entry('gone') });
    getHistoryMock.mockResolvedValue([summary('a')]);

    await useHistoryStore.getState().load();

    expect(useHistoryStore.getState().selectedId).toBeUndefined();
    expect(useHistoryStore.getState().selectedEntry).toBeUndefined();
  });

  it('should reject malformed entries from the main process', async () => {
    getHistoryMock.mockResolvedValue([{ id: 'a' } as HistoryEntrySummary]);

    await useHistoryStore.getState().load();

    expect(showErrorMock).toHaveBeenCalledWith(
      'Received an invalid request history',
      expect.anything()
    );
    expect(useHistoryStore.getState().entries).toEqual([]);
  });

  it('should load the full entry when selected', async () => {
    getHistoryEntryMock.mockResolvedValue(entry('a'));

    await useHistoryStore.getState().select('a');

    expect(getHistoryEntryMock).toHaveBeenCalledWith('a');
    expect(useHistoryStore.getState().selectedEntry?.id).toBe('a');
  });

  it('should ignore a slow entry if another one was selected in the meantime', async () => {
    let resolveFirst: (value: HistoryEntry) => void = () => {};
    getHistoryEntryMock
      .mockReturnValueOnce(new Promise((resolve) => (resolveFirst = resolve)))
      .mockResolvedValueOnce(entry('b'));

    const first = useHistoryStore.getState().select('a');
    await useHistoryStore.getState().select('b');
    resolveFirst(entry('a'));
    await first;

    expect(useHistoryStore.getState().selectedEntry?.id).toBe('b');
  });

  it('should clear the history in the main process', async () => {
    clearHistoryMock.mockResolvedValue();

    await useHistoryStore.getState().clear();

    expect(clearHistoryMock).toHaveBeenCalledOnce();
  });

  it('should validate entries received from the main process', () => {
    useHistoryStore.getState().receive([summary('a')]);
    expect(useHistoryStore.getState().entries.map((e) => e.id)).toEqual(['a']);

    expect(() => useHistoryStore.getState().receive([{ id: 'b' }])).not.toThrow();
    expect(showErrorMock).toHaveBeenCalledWith(
      'Received an invalid request history',
      expect.anything()
    );
    expect(useHistoryStore.getState().entries.map((e) => e.id)).toEqual(['a']);
  });

  it('should take over the entries pushed by the main process', () => {
    useHistoryStore.setState({ selectedId: 'gone', selectedEntry: entry('gone') });

    useHistoryStore.getState().receive([summary('a')]);

    expect(useHistoryStore.getState().entries.map((e) => e.id)).toEqual(['a']);
    expect(useHistoryStore.getState().selectedId).toBeUndefined();
  });
});
