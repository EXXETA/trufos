import { useEffect, useRef, useState, FC, PropsWithChildren } from 'react';
import { Loader2 } from 'lucide-react';
import { RendererEventService } from '@/services/event/renderer-event-service';
import {
  createCollectionStore,
  CollectionStoreProvider as StoreProvider,
  selectRequest,
} from '@/state/collectionStore';
import { REQUEST_MODEL, SCRIPT_MODEL } from '@/lib/monaco/models';
import { showError } from '@/error/errorHandler';

const rendererEventService = RendererEventService.instance;

export const CollectionStoreProvider: FC<PropsWithChildren> = ({ children }) => {
  const storeRef = useRef<ReturnType<typeof createCollectionStore> | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const initializeStore = async () => {
      try {
        const collection = await rendererEventService.loadCollection();

        // Create store with loaded collection
        storeRef.current = createCollectionStore(collection);

        // Set up before-close handler with access to store instance
        rendererEventService.on('before-close', async () => {
          try {
            console.info('Saving current request body and script');
            const state = storeRef.current!.getState();
            const request = selectRequest(state);
            if (request != null && request.draft) {
              console.debug(`Saving request with ID ${request.id}`);
              await rendererEventService.saveRequest(request, REQUEST_MODEL.getValue());
              await rendererEventService.saveScript(
                request,
                state.currentScriptType,
                SCRIPT_MODEL.getValue()
              );
            }
          } catch (error) {
            console.error('Error while saving request before closing:', error);
          } finally {
            rendererEventService.emit('ready-to-close');
          }
        });

        setReady(true);
      } catch (error) {
        showError("Couldn't load collection store", error);
      }
    };

    initializeStore();
  }, []);

  if (!ready || !storeRef.current) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  return <StoreProvider value={storeRef.current}>{children}</StoreProvider>;
};