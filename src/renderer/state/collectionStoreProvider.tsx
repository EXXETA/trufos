import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { RendererEventService } from '@/services/event/renderer-event-service';
import {
  createCollectionStore,
  CollectionStoreProvider as StoreProvider,
  selectRequest,
} from '@/state/collectionStore';
import { REQUEST_MODEL } from '@/lib/monaco/models';

interface CollectionStoreProviderProps {
  children: ReactNode;
}

const rendererEventService = RendererEventService.instance;

export const CollectionStoreProvider = ({ children }: CollectionStoreProviderProps) => {
  const storeRef = useRef<ReturnType<typeof createCollectionStore> | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let isActive = true;

    const initializeStore = async () => {
      try {
        const collection = await rendererEventService.loadCollection();
        if (!isActive) return;

        // Create store with loaded collection
        storeRef.current = createCollectionStore(collection);

        // Set up before-close handler with access to store instance
        rendererEventService.on('before-close', async () => {
          try {
            console.info('Saving current request body');
            const request = selectRequest(storeRef.current!.getState());
            if (request != null && request.draft) {
              console.debug(`Saving request with ID ${request.id}`);
              await rendererEventService.saveRequest(request, REQUEST_MODEL.getValue());
            }
          } catch (error) {
            console.error('Error while saving request before closing:', error);
          } finally {
            rendererEventService.emit('ready-to-close');
          }
        });

        setReady(true);
      } catch (error) {
        console.error('Failed to initialize collection store:', error);
      }
    };

    initializeStore();

    return () => {
      isActive = false;
    };
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
