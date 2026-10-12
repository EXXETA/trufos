import { useEffect, useState, FC, PropsWithChildren } from 'react';
import { Loader2 } from 'lucide-react';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { MainProcessEvent, MainProcessEventPayloads, RendererEvent } from 'shim/event-service';
import {
  CollectionStore,
  createCollectionStore,
  createModelPersistence,
  CollectionStoreProvider as StoreProvider,
} from '@/state/collectionStore';
import { CollectionReplica } from '@/state/collection-replica';
import { flushModelEdits, registerModelPersistence } from '@/lib/monaco/models';
import { showError } from '@/error/errorHandler';

const rendererEventService = RendererEventService.instance;

type Listener<E extends MainProcessEvent> = (
  ipcEvent: unknown,
  ...payload: MainProcessEventPayloads[E]
) => void;

export const CollectionStoreProvider: FC<PropsWithChildren> = ({ children }) => {
  const [store, setStore] = useState<CollectionStore | null>(null);

  useEffect(() => {
    let replica: CollectionReplica | undefined;
    let disposed = false;

    // Registered before the snapshot is fetched: earlier changes are part of the snapshot
    const onStateChanged: Listener<MainProcessEvent.CollectionStateChanged> = (_, event) => {
      if (!disposed) replica?.receive(event);
    };

    // Send all pending editor changes to main before the window closes
    const onBeforeClose: Listener<MainProcessEvent.BeforeClose> = async () => {
      try {
        console.info('Saving all editor changes before close');
        await flushModelEdits();
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
        replica = new CollectionReplica(
          snapshot,
          (envelope) => rendererEventService.dispatch(envelope),
          () => rendererEventService.getCollectionState()
        );
        registerModelPersistence(createModelPersistence(replica));
        setStore(createCollectionStore(replica));
      } catch (error) {
        showError("Couldn't load collection store", error);
      }
    };

    void initializeStore();

    return () => {
      disposed = true;
      registerModelPersistence(undefined);
      rendererEventService
        .removeListener(MainProcessEvent.CollectionStateChanged, onStateChanged)
        .removeListener(MainProcessEvent.BeforeClose, onBeforeClose);
    };
  }, []);

  if (store == null) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  return <StoreProvider value={store}>{children}</StoreProvider>;
};
