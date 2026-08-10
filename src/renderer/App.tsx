import '@/styles/index.css';
import { useEffect } from 'react';
import { Menubar } from '@/view/Menubar';
import { RequestWindow } from '@/view/RequestWindow';
import { CollectionRunner } from '@/view/CollectionRunner';
import { CollectionSettingsModal } from '@/components/shared/settings/CollectionSettingsModal';
import { AppSettingsModal } from '@/components/shared/settings/AppSettingsModal';
import { SidebarProvider } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ResizablePanel, ResizablePanelGroup, ResizableHandle } from '@/components/ui/resizable';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { CollectionStoreProvider } from '@/state/CollectionStoreProvider';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { useAppSettingsStore } from '@/state/appSettingsStore';
import {
  selectIsCollectionRunnerOpen,
  selectIsCollectionSettingsOpen,
  selectIsCommandPaletteOpen,
  selectIsAppSettingsOpen,
  useViewActions,
  useViewStore,
} from '@/state/viewStore';
import { CommandPalette } from '@/components/commandPalette/CommandPalette';
import { useHotkeys } from '@/hooks/hotKeys/useHotkey';
import { HOTKEYS } from '@/hooks/hotKeys/hotkeys';
import { showError } from '@/error/errorHandler';
import { t } from '@/i18n';

const MIN_SIDEBAR_PIXELS = 300;
const MIN_REQUEST_WINDOW_PIXELS = 500;

export const App = () => {
  const isCollectionRunnerOpen = useViewStore(selectIsCollectionRunnerOpen);
  const isCollectionSettingsOpen = useViewStore(selectIsCollectionSettingsOpen);
  const isCommandPaletteOpen = useViewStore(selectIsCommandPaletteOpen);
  const isAppSettingsOpen = useViewStore(selectIsAppSettingsOpen);
  const {
    closeCollectionRunner,
    closeCollectionSettings,
    openCommandPalette,
    closeCommandPalette,
    closeAppSettings,
  } = useViewActions();

  useHotkeys([{ keys: HOTKEYS.openCommandPalette, handler: openCommandPalette }]);

  useEffect(() => {
    // Entry points of the native application menu (Collection > ...).
    RendererEventService.instance
      .on('show-collection-runner', () => useViewStore.getState().openCollectionRunner())
      .on('show-collection-settings', () => useViewStore.getState().openCollectionSettings());

    RendererEventService.instance
      .getAppSettings()
      .catch((err) => {
        showError(t('errors.loadAppSettings'), err);
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
            <CommandPalette open={isCommandPaletteOpen} onClose={closeCommandPalette} />
            <AppSettingsModal isOpen={isAppSettingsOpen} onClose={closeAppSettings} />
          </SidebarProvider>
        </TooltipProvider>
      </ThemeProvider>
    </CollectionStoreProvider>
  );
};
