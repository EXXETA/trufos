import { useEffect, useRef, useState, FC, PropsWithChildren } from 'react';
import { Loader2 } from 'lucide-react';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { MainProcessEvent, RendererEvent } from 'shim/event-service';
import {
  createCollectionStore,
  CollectionStoreProvider as StoreProvider,
} from '@/state/collectionStore';
import { saveModelContent } from '@/lib/monaco/models';
import { editor } from 'monaco-editor';
import { showError } from '@/error/errorHandler';
import { useVariableStore } from '@/state/variableStore';
import { useEnvironmentStore } from '@/state/environmentStore';

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

        // Sync variables changed by scripts back to the frontend stores
        rendererEventService.on(
          MainProcessEvent.CollectionVariablesUpdated,
          (_ipcEvent, { variables, environments }) => {
            useVariableStore.getState().initialize(variables);
            useEnvironmentStore.getState().initialize(environments);
          }
        );

        // Set up before-close handler: flush all active editor models to disk
        rendererEventService.on(MainProcessEvent.BeforeClose, async () => {
          try {
            console.info('Saving all active editor models before close');
            await Promise.all(editor.getModels().map(saveModelContent));
          } catch (error) {
            console.error('Error while saving models before closing:', error);
          } finally {
            rendererEventService.emit(RendererEvent.ReadyToClose);
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
