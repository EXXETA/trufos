import '@/styles/index.css';
import { useEffect } from 'react';
import { Menubar } from '@/view/Menubar';
import { RequestWindow } from '@/view/RequestWindow';
import { CollectionRunner } from '@/view/CollectionRunner';
import { useCollectionRunnerStore } from '@/state/collectionRunnerStore';
import { SidebarProvider } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ResizablePanel, ResizablePanelGroup, ResizableHandle } from '@/components/ui/resizable';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { CollectionStoreProvider } from '@/state/CollectionStoreProvider';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { useAppSettingsStore } from '@/state/appSettingsStore';
import { showError } from '@/error/errorHandler';

const MIN_SIDEBAR_PIXELS = 300;
const MIN_REQUEST_WINDOW_PIXELS = 500;

export const App = () => {
  const isRunnerOpen = useCollectionRunnerStore((state) => state.isOpen);

  useEffect(() => {
    RendererEventService.instance
      .getAppSettings()
      .catch((err) => {
        showError('Failed to load app settings', err);
      })
      .then((settings) => {
        if (settings) {
          useAppSettingsStore.getState().initialize(settings);
        }
        window.electron.ipcRenderer.send('renderer-ready');
      });
  }, []);

  return (
    <CollectionStoreProvider>
      <ThemeProvider>
        <TooltipProvider delayDuration={750}>
          <SidebarProvider className="grid">
            <ResizablePanelGroup orientation="horizontal" className="h-full w-full">
              <ResizablePanel defaultSize="25%" minSize={MIN_SIDEBAR_PIXELS}>
                <Menubar />
              </ResizablePanel>
              <ResizableHandle />
              <ResizablePanel defaultSize="75%" minSize={MIN_REQUEST_WINDOW_PIXELS}>
                {isRunnerOpen ? <CollectionRunner /> : <RequestWindow />}
              </ResizablePanel>
            </ResizablePanelGroup>
          </SidebarProvider>
        </TooltipProvider>
      </ThemeProvider>
    </CollectionStoreProvider>
  );
};
