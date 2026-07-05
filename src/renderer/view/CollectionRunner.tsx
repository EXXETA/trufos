import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { editor } from 'monaco-editor';
import { CircleCheck, CircleMinus, CircleX, FolderIcon, Loader2, Play, X } from 'lucide-react';
import { Folder } from 'shim/objects/folder';
import { TrufosRequest } from 'shim/objects/request';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { IconButton } from '@/components/ui/icon-button';
import { Divider } from '@/components/shared/Divider';
import {
  getDurationTextInSec,
  getHttpStatusColorClass,
  getHttpStatusText,
  getSizeText,
} from '@/components/mainWindow/responseStatus/ResponseStatusFormatter';
import { httpMethodColor } from '@/services/StyleHelper';
import { saveModelContent } from '@/lib/monaco/models';
import { useCollectionStore } from '@/state/collectionStore';
import {
  listRequestsInOrder,
  listRunnerTreeItems,
  RunResult,
  RunResultStatus,
  selectRunSummary,
  useCollectionRunnerActions,
  useCollectionRunnerStore,
} from '@/state/collectionRunnerStore';
import { cn } from '@/lib/utils';

const RunResultInfo = ({ result }: { result?: RunResult }) => {
  switch (result?.status) {
    case RunResultStatus.RUNNING:
      return <Loader2 className="text-text-secondary h-4 w-4 animate-spin" />;
    case RunResultStatus.PENDING:
      return <span className="text-text-secondary text-xs">queued</span>;
    case RunResultStatus.SKIPPED:
      return (
        <span className="text-text-secondary flex items-center gap-1 text-xs">
          <CircleMinus className="h-4 w-4" /> skipped
        </span>
      );
    case RunResultStatus.PASSED:
    case RunResultStatus.FAILED: {
      const passed = result.status === RunResultStatus.PASSED;
      const { response, error } = result;
      return (
        <span className="flex items-center gap-2 text-xs">
          {response != null && (
            <>
              <span className={getHttpStatusColorClass(response.metaInfo.status)}>
                {getHttpStatusText(response.metaInfo.status)}
              </span>
              <span className="text-text-secondary">
                {getDurationTextInSec(response.metaInfo.duration)}
              </span>
              <span className="text-text-secondary">
                {getSizeText(response.metaInfo.size.totalSizeInBytes)}
              </span>
            </>
          )}
          {error != null && <span className="text-danger max-w-96 truncate">{error}</span>}
          {passed ? (
            <CircleCheck className="success h-4 w-4" />
          ) : (
            <CircleX className="text-danger h-4 w-4" />
          )}
        </span>
      );
    }
    default:
      return null;
  }
};

export function CollectionRunner() {
  const collection = useCollectionStore((state) => state.collection);
  const { closeRunner, run, cancel, toggleRequestSelection, setAllSelected, setStopOnFailure } =
    useCollectionRunnerActions();
  const isRunning = useCollectionRunnerStore((state) => state.isRunning);
  const cancelRequested = useCollectionRunnerStore((state) => state.cancelRequested);
  const stopOnFailure = useCollectionRunnerStore((state) => state.stopOnFailure);
  const deselectedRequestIds = useCollectionRunnerStore((state) => state.deselectedRequestIds);
  const results = useCollectionRunnerStore((state) => state.results);
  const lastRunDurationMs = useCollectionRunnerStore((state) => state.lastRunDurationMs);
  const summary = useCollectionRunnerStore(useShallow(selectRunSummary));

  const treeItems = useMemo(() => listRunnerTreeItems(collection?.children ?? []), [collection]);
  const requests = useMemo(() => listRequestsInOrder(collection?.children ?? []), [collection]);
  const selectedCount = requests.filter(({ id }) => !deselectedRequestIds.has(id)).length;

  const startRun = useCallback(async () => {
    // persist any unsaved editor contents so the run uses the latest state
    await Promise.all(editor.getModels().map(saveModelContent));
    await run(requests);
  }, [run, requests]);

  const isSelected = (request: TrufosRequest) => !deselectedRequestIds.has(request.id);

  const folderCheckedState = (folder: Folder) => {
    const folderRequests = listRequestsInOrder(folder.children);
    if (folderRequests.length === 0) return false;
    const selected = folderRequests.filter(isSelected).length;
    if (selected === 0) return false;
    return selected === folderRequests.length ? true : ('indeterminate' as const);
  };

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h2 className="text-lg font-semibold">Collection Runner</h2>
          <span className="text-text-secondary text-xs">{collection?.title}</span>
        </div>
        <IconButton onClick={closeRunner} aria-label="Close collection runner">
          <X />
        </IconButton>
      </div>

      <Divider />

      <div className="flex items-center gap-6">
        {isRunning ? (
          <Button variant="secondary" onClick={cancel} disabled={cancelRequested}>
            {cancelRequested ? 'Stopping…' : 'Cancel'}
          </Button>
        ) : (
          <Button onClick={startRun} disabled={selectedCount === 0}>
            <Play className="h-4 w-4" /> Run
          </Button>
        )}

        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox
            checked={stopOnFailure}
            onCheckedChange={(checked) => setStopOnFailure(checked === true)}
            disabled={isRunning}
          />
          Stop on first failure
        </label>

        <span className="text-text-secondary ml-auto text-xs">
          {selectedCount} of {requests.length} requests selected
        </span>
      </div>

      {lastRunDurationMs != null && (
        <div className="bg-background-secondary flex items-center gap-4 rounded-md px-4 py-2 text-sm">
          <span className={cn('font-semibold', summary.failed > 0 ? 'text-danger' : 'success')}>
            {summary.passed} / {summary.total} passed
          </span>
          {summary.failed > 0 && <span className="text-danger">{summary.failed} failed</span>}
          {summary.skipped > 0 && (
            <span className="text-text-secondary">{summary.skipped} skipped</span>
          )}
          <span className="text-text-secondary ml-auto">
            Total duration: {getDurationTextInSec(summary.durationMs)}
          </span>
        </div>
      )}

      <div className="tabs-scrollbar flex-1 overflow-y-auto">
        {requests.length === 0 ? (
          <span className="text-text-secondary text-sm">
            This collection does not contain any requests.
          </span>
        ) : (
          <>
            <label className="flex cursor-pointer items-center gap-3 py-2 text-xs">
              <Checkbox
                checked={
                  selectedCount === 0
                    ? false
                    : selectedCount === requests.length
                      ? true
                      : 'indeterminate'
                }
                onCheckedChange={(checked) =>
                  setAllSelected(
                    requests.map(({ id }) => id),
                    checked === true
                  )
                }
                disabled={isRunning}
                aria-label="Select all requests"
              />
              Select all
            </label>

            {treeItems.map(({ item, depth }) =>
              item.type === 'folder' ? (
                <div
                  key={item.id}
                  className="flex items-center gap-3 py-2"
                  style={{ paddingLeft: `${depth * 1.5}rem` }}
                >
                  <Checkbox
                    checked={folderCheckedState(item)}
                    onCheckedChange={(checked) =>
                      setAllSelected(
                        listRequestsInOrder(item.children).map(({ id }) => id),
                        checked === true
                      )
                    }
                    disabled={isRunning || listRequestsInOrder(item.children).length === 0}
                    aria-label={`Select all requests in ${item.title}`}
                  />
                  <FolderIcon className="text-text-secondary h-4 w-4 shrink-0" />
                  <span className="truncate text-sm font-medium">{item.title}</span>
                </div>
              ) : (
                <div
                  key={item.id}
                  className="hover:bg-background-secondary flex items-center gap-3 rounded-sm py-2"
                  style={{ paddingLeft: `${depth * 1.5}rem` }}
                >
                  <Checkbox
                    checked={isSelected(item)}
                    onCheckedChange={() => toggleRequestSelection(item.id)}
                    disabled={isRunning}
                    aria-label={`Include ${item.title || item.url.base} in run`}
                  />
                  <span className={cn('shrink-0 text-xs font-bold', httpMethodColor(item.method))}>
                    {item.method}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {item.title || item.url.base}
                  </span>
                  <span className="mr-2 flex shrink-0 items-center">
                    <RunResultInfo result={results[item.id]} />
                  </span>
                </div>
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}
