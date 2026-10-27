import { useEffect, useState, FC, PropsWithChildren } from 'react';
import { Loader2 } from 'lucide-react';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { MainProcessEvent, MainProcessEventListener, RendererEvent } from 'shim/event-service';
import {
  CollectionStore,
  createCollectionStore,
  CollectionStoreProvider as StoreProvider,
} from '@/state/collectionStore';
import { CollectionState } from '@/state/collection-state';
import { flushModelEdits } from '@/lib/monaco/models';
import { showError } from '@/error/errorHandler';
import { useViewStore } from '@/state/viewStore';

const rendererEventService = RendererEventService.instance;

export const CollectionStoreProvider: FC<PropsWithChildren> = ({ children }) => {
  const [store, setStore] = useState<CollectionStore | null>(null);

  useEffect(() => {
    let collectionState: CollectionState | undefined;
    let flushUiState: (() => Promise<void>) | undefined;
    let disposed = false;

    // Registered before the snapshot is fetched: earlier changes are part of the snapshot
    const onStateChanged: MainProcessEventListener<MainProcessEvent.CollectionStateChanged> = (
      _,
      event
    ) => {
      if (!disposed) collectionState?.receive(event);
    };

    // Send all pending editor changes and the UI state to main before the window closes
    const onBeforeClose: MainProcessEventListener<MainProcessEvent.BeforeClose> = async () => {
      try {
        console.info('Saving all editor changes before close');
        // the UI state is only sent, failures are logged by the store
        await Promise.all([flushModelEdits(), flushUiState?.()]);
      } catch (error) {
        console.error('Error while saving editor changes before closing:', error);
      } finally {
        rendererEventService.emit(RendererEvent.ReadyToClose);
      }
    };

    rendererEventService
      .on(MainProcessEvent.CollectionStateChanged, onStateChanged)
      .on(MainProcessEvent.BeforeClose, onBeforeClose);

    const initializeStore = async () => {
      try {
        const snapshot = await rendererEventService.getCollectionState();
        if (disposed) return;
        const created = createCollectionStore(
          snapshot,
          (envelope) => rendererEventService.dispatch(envelope),
          () => rendererEventService.getCollectionState()
        );
        collectionState = created.collectionState;
        flushUiState = created.flushUiState;
        setStore(created.store);
      } catch (error) {
        showError("Couldn't load collection store", error);
      }
    };

    void initializeStore();

    return () => {
      disposed = true;
      rendererEventService
        .removeListener(MainProcessEvent.CollectionStateChanged, onStateChanged)
        .removeListener(MainProcessEvent.BeforeClose, onBeforeClose);
    };
  }, []);

  // The files of the collection may be changed outside the app, e.g. by git. Main watches them;
  // as a fallback for changes the watcher misses, everything is written when the window loses
  // focus and reloaded if it changed when it gets focus back.
  useEffect(() => {
    if (store == null) return;
    const onBlur = () => void store.getState().flushToDisk();
    const onFocus = () => void store.getState().checkForChanges();
    const onReload = () => void store.getState().reloadFromDisk();
    const onRequestFilesChanged: MainProcessEventListener<MainProcessEvent.RequestFilesChanged> = (
      _,
      requestIds
    ) => void store.getState().refreshRequestContent(requestIds);
    // e.g. an MCP client points the user to a request
    const onShowRequest: MainProcessEventListener<MainProcessEvent.ShowRequest> = (
      _,
      requestId
    ) => {
      useViewStore.getState().setSidebarView('requests');
      void store.getState().setSelectedRequest(requestId);
    };
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    rendererEventService
      .on(MainProcessEvent.ReloadCollection, onReload)
      .on(MainProcessEvent.RequestFilesChanged, onRequestFilesChanged)
      .on(MainProcessEvent.ShowRequest, onShowRequest);
    return () => {
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      rendererEventService
        .removeListener(MainProcessEvent.ReloadCollection, onReload)
        .removeListener(MainProcessEvent.RequestFilesChanged, onRequestFilesChanged)
        .removeListener(MainProcessEvent.ShowRequest, onShowRequest);
    };
  }, [store]);

  if (store == null) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  return <StoreProvider value={store}>{children}</StoreProvider>;
};
