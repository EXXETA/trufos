import { useEffect, useRef, useState, FC, PropsWithChildren } from 'react';
import { Loader2 } from 'lucide-react';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { createAppStore, CollectionStoreProvider as StoreProvider } from '@/state/appStore';
import { saveModelContent } from '@/lib/monaco/models';
import { editor } from 'monaco-editor';
import { showError } from '@/error/errorHandler';
import { EnvironmentMap } from 'shim/objects/environment';
import { VariableMap } from 'shim/objects/variables';
import { z } from 'zod';

const rendererEventService = RendererEventService.instance;
const CollectionVariablesUpdated = z.object({
  variables: VariableMap,
  environments: EnvironmentMap,
});

export const CollectionStoreProvider: FC<PropsWithChildren> = ({ children }) => {
  const storeRef = useRef<ReturnType<typeof createAppStore> | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const initializeStore = async () => {
      try {
        const collection = await rendererEventService.loadCollection();

        // Create store with loaded collection
        storeRef.current = createAppStore(collection);

        // Sync variables changed by scripts back to the root store.
        rendererEventService.on('collection-variables-updated', (...args: unknown[]) => {
          const update = CollectionVariablesUpdated.safeParse(args[1]);
          if (!update.success) {
            console.error('Received invalid collection variables update:', update.error);
            return;
          }
          storeRef.current
            ?.getState()
            .syncCollectionVariables(update.data.variables, update.data.environments);
        });

        // Set up before-close handler: flush all active editor models to disk
        rendererEventService.on('before-close', async () => {
          try {
            console.info('Saving all active editor models before close');
            await Promise.all(editor.getModels().map(saveModelContent));
          } catch (error) {
            console.error('Error while saving models before closing:', error);
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
