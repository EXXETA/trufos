import '@/styles/index.css';
import { useEffect } from 'react';
import { Menubar } from '@/view/Menubar';
import { RequestWindow } from '@/view/RequestWindow';
import { CollectionRunner } from '@/view/CollectionRunner';
import { CollectionSettingsModal } from '@/components/shared/settings/CollectionSettingsModal';
import { SidebarProvider } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ResizablePanel, ResizablePanelGroup, ResizableHandle } from '@/components/ui/resizable';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { CollectionStoreProvider } from '@/state/CollectionStoreProvider';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { useAppStore } from '@/state/collectionStore';
import {
  selectIsCollectionRunnerOpen,
  selectIsCollectionSettingsOpen,
  useViewActions,
  useViewStore,
} from '@/state/viewStore';
import { showError } from '@/error/errorHandler';

const MIN_SIDEBAR_PIXELS = 300;
const MIN_REQUEST_WINDOW_PIXELS = 500;

const AppContent = () => {
  const isCollectionRunnerOpen = useViewStore(selectIsCollectionRunnerOpen);
  const isCollectionSettingsOpen = useViewStore(selectIsCollectionSettingsOpen);
  const {
    closeCollectionRunner,
    closeCollectionSettings,
    openCollectionRunner,
    openCollectionSettings,
  } = useViewActions();
  const initializeAppSettings = useAppStore((state) => state.initializeAppSettings);

  useEffect(() => {
    // Entry points of the native application menu (Collection > ...).
    RendererEventService.instance
      .on('show-collection-runner', openCollectionRunner)
      .on('show-collection-settings', openCollectionSettings);

    RendererEventService.instance
      .getAppSettings()
      .catch((err) => {
        showError('Failed to load app settings', err);
      })
      .then((settings) => {
        if (settings != null) {
          initializeAppSettings(settings);
        } else {
          initializeAppSettings(undefined);
        }
        window.electron.ipcRenderer.send('renderer-ready');
      });
  }, [initializeAppSettings, openCollectionRunner, openCollectionSettings]);

  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={750}>
        <SidebarProvider className="grid">
          {/* The runner replaces the whole layout as an alternative full-width view;
              its own request checklist makes the sidebar redundant. */}
          {isCollectionRunnerOpen ? (
            <CollectionRunner open onClose={closeCollectionRunner} />
          ) : (
            <ResizablePanelGroup orientation="horizontal" className="h-full w-full">
              <ResizablePanel defaultSize="25%" minSize={MIN_SIDEBAR_PIXELS}>
                <Menubar />
              </ResizablePanel>
              <ResizableHandle />
              <ResizablePanel defaultSize="75%" minSize={MIN_REQUEST_WINDOW_PIXELS}>
                <RequestWindow />
              </ResizablePanel>
            </ResizablePanelGroup>
          )}
          <CollectionSettingsModal
            isOpen={isCollectionSettingsOpen}
            onClose={closeCollectionSettings}
          />
        </SidebarProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
};

export const App = () => (
  <CollectionStoreProvider>
    <AppContent />
  </CollectionStoreProvider>
);
