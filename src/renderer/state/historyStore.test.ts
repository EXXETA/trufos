import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useHistoryStore } from './historyStore';
import { RequestMethod } from 'shim/objects/request-method';

const getHistoryMock = vi.fn();
const clearHistoryMock = vi.fn().mockResolvedValue(undefined);

vi.mock('@/services/event/renderer-event-service', () => ({
  RendererEventService: {
    instance: {
      getHistory: () => getHistoryMock(),
      clearHistory: () => clearHistoryMock(),
    },
  },
}));

describe('historyStore', () => {
  beforeEach(() => {
    getHistoryMock.mockClear();
    clearHistoryMock.mockClear();
    useHistoryStore.setState({ entries: [], isLoading: false });
  });

  describe('loadHistory', () => {
    it('sets loading state and retrieves entries', async () => {
      const mockEntries = [
        {
          id: '1',
          timestamp: 12345,
          request: { url: 'http://example.com', method: 'GET', headers: [] },
          response: { status: 200, duration: 100, size: 50 },
        },
      ];
      getHistoryMock.mockResolvedValue(mockEntries);

      const promise = useHistoryStore.getState().loadHistory();
      expect(useHistoryStore.getState().isLoading).toBe(true);

      await promise;
      expect(useHistoryStore.getState().isLoading).toBe(false);
      expect(useHistoryStore.getState().entries).toEqual(mockEntries);
      expect(getHistoryMock).toHaveBeenCalled();
    });

    it('handles errors gracefully', async () => {
      getHistoryMock.mockRejectedValue(new Error('IPC failed'));

      await useHistoryStore.getState().loadHistory();
      expect(useHistoryStore.getState().isLoading).toBe(false);
      expect(useHistoryStore.getState().entries).toEqual([]);
    });
  });

  describe('clearHistory', () => {
    it('notifies IPC and clears entries from state', async () => {
      useHistoryStore.setState({
        entries: [
          {
            id: '1',
            timestamp: 12345,
            request: { url: 'http://example.com', method: RequestMethod.GET, headers: [] },
            response: { status: 200, duration: 100, size: 50 },
          },
        ],
      });

      await useHistoryStore.getState().clearHistory();
      expect(useHistoryStore.getState().entries).toEqual([]);
      expect(clearHistoryMock).toHaveBeenCalled();
    });
  });
});
