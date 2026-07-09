import React, { useEffect } from 'react';
import {
  useHistoryStore,
  selectHistoryEntries,
  selectHistoryIsLoading,
} from '@/state/historyStore';
import { useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { useViewActions } from '@/state/viewStore';
import { SidebarContent } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Trash2, RotateCw, Clock, ArrowUpRight, X } from 'lucide-react';
import { httpMethodColor } from '@/services/StyleHelper';
import { cn } from '@/lib/utils';
import { parseUrl } from 'shim/objects/url';

export const HistoryPanel = () => {
  const entries = useHistoryStore(selectHistoryEntries);
  const isLoading = useHistoryStore(selectHistoryIsLoading);
  const { loadHistory, clearHistory } = useHistoryStore();
  const { setSidebarTab } = useViewActions();

  const requests = useCollectionStore((state) => state.requests);
  const selectedRequestId = useCollectionStore((state) => state.selectedRequestId);
  const { setSelectedRequest, updateRequest } = useCollectionActions();

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const handleClearHistory = () => {
    if (window.confirm('Are you sure you want to clear the request history?')) {
      void clearHistory();
    }
  };

  const handleRestore = (entry: (typeof entries)[number]) => {
    // If the original request exists in the current collection, select it first
    let targetRequestId = selectedRequestId;
    if (entry.sourceRequestId && requests.has(entry.sourceRequestId)) {
      setSelectedRequest(entry.sourceRequestId);
      targetRequestId = entry.sourceRequestId;
    }

    if (!targetRequestId) {
      alert('Please select or create a request to restore these details into.');
      return;
    }

    // Parse the URL and update the request
    const parsedUrl = parseUrl(entry.request.url);
    updateRequest({
      url: parsedUrl,
      method: entry.request.method,
      headers: entry.request.headers,
    });
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <SidebarContent className="flex h-full flex-col overflow-hidden">
      <div className="border-border flex shrink-0 items-center justify-between border-b px-2 py-3">
        <div className="flex items-center gap-2">
          <Clock className="text-text-secondary h-4 w-4" />
          <span className="text-sm font-semibold">Request History</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="text-text-secondary hover:text-text-primary h-7 w-7"
            onClick={() => void loadHistory()}
            disabled={isLoading}
            title="Refresh History"
          >
            <RotateCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-text-secondary hover:text-danger h-7 w-7"
            onClick={handleClearHistory}
            disabled={entries.length === 0}
            title="Clear History"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-text-secondary hover:text-text-primary h-7 w-7"
            onClick={() => setSidebarTab('requests')}
            title="Close History"
            aria-label="Close History"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto py-2 pr-1">
        {entries.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center p-4 text-center">
            <Clock className="text-text-secondary/40 mb-2 h-8 w-8" />
            <p className="text-text-secondary text-sm font-medium">No history yet</p>
            <p className="text-text-secondary/60 mt-1 text-xs">
              Requests you send will appear here.
            </p>
          </div>
        ) : (
          entries.map((entry) => {
            const hasOriginal = entry.sourceRequestId && requests.has(entry.sourceRequestId);
            return (
              <div
                key={entry.id}
                className="group hover:bg-sidebar-accent hover:border-border relative flex cursor-pointer flex-col rounded-lg border border-transparent p-2.5 transition-all duration-200"
                onClick={() => handleRestore(entry)}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={cn(
                      'text-[10px] font-bold tracking-wider uppercase',
                      httpMethodColor(entry.request.method)
                    )}
                  >
                    {entry.request.method}
                  </span>
                  <div className="text-text-secondary flex items-center gap-1.5 text-[10px]">
                    <span>{formatDate(entry.timestamp)}</span>
                    <span>{formatTime(entry.timestamp)}</span>
                  </div>
                </div>

                <div
                  className="text-text-primary mb-1 truncate pr-6 text-xs font-medium"
                  title={entry.request.url}
                >
                  {entry.request.url}
                </div>

                <div className="text-text-secondary flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'font-semibold',
                        entry.response.status >= 200 &&
                          entry.response.status < 300 &&
                          'text-state-success',
                        entry.response.status >= 300 &&
                          entry.response.status < 400 &&
                          'text-text-secondary',
                        entry.response.status >= 400 && 'text-danger',
                        entry.response.status === 0 && 'text-danger'
                      )}
                    >
                      {entry.response.status === 0 ? 'ERR' : entry.response.status}
                    </span>
                    <span>•</span>
                    <span>{entry.response.duration} ms</span>
                    {entry.response.size > 0 && (
                      <>
                        <span>•</span>
                        <span>{formatSize(entry.response.size)}</span>
                      </>
                    )}
                  </div>
                  {entry.sourceRequestTitle && (
                    <span className="bg-background-secondary border-border max-w-[120px] truncate rounded border px-1 text-[9px]">
                      {entry.sourceRequestTitle}
                    </span>
                  )}
                </div>

                <div className="absolute top-1/2 right-2.5 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    size="icon"
                    variant="secondary"
                    className="border-border h-6 w-6 rounded-md border shadow-sm"
                    title={
                      hasOriginal ? 'Restore to original request' : 'Restore to selected request'
                    }
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </SidebarContent>
  );
};
