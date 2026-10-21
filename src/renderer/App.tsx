import '@/styles/index.css';
import { useEffect } from 'react';
import { useDefaultLayout } from 'react-resizable-panels';
import { Menubar } from '@/view/Menubar';
import { RequestWindow } from '@/view/RequestWindow';
import { CollectionRunner } from '@/view/CollectionRunner';
import { CollectionSettingsModal } from '@/components/shared/settings/CollectionSettingsModal';
import { FolderSettingsModal } from '@/components/shared/settings/FolderSettingsModal';
import { AppSettingsModal } from '@/components/shared/settings/AppSettingsModal';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ResizablePanel, ResizablePanelGroup, ResizableHandle } from '@/components/ui/resizable';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { CollectionStoreProvider } from '@/state/CollectionStoreProvider';
import { useHistoryStore } from '@/state/historyStore';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { MainProcessEvent, RendererEvent } from 'shim/event-service';
import { useAppSettingsStore } from '@/state/appSettingsStore';
import {
  selectIsCollectionRunnerOpen,
  selectIsCollectionSettingsOpen,
  selectFolderSettingsId,
  selectIsCommandPaletteOpen,
  selectIsAppSettingsOpen,
  useViewActions,
  useViewStore,
} from '@/state/viewStore';
import { CommandPalette } from '@/components/commandPalette/CommandPalette';
import { useHotkeys } from '@/hooks/hotKeys/useHotkey';
import { HOTKEYS } from '@/hooks/hotKeys/hotkeys';
import { showError } from '@/error/errorHandler';

const MIN_SIDEBAR_PIXELS = 300;
const MIN_REQUEST_WINDOW_PIXELS = 500;

export const App = () => {
  const isCollectionRunnerOpen = useViewStore(selectIsCollectionRunnerOpen);
  const isCollectionSettingsOpen = useViewStore(selectIsCollectionSettingsOpen);
  const folderSettingsId = useViewStore(selectFolderSettingsId);
  const isCommandPaletteOpen = useViewStore(selectIsCommandPaletteOpen);
  const isAppSettingsOpen = useViewStore(selectIsAppSettingsOpen);
  const layout = useDefaultLayout({ id: 'trufos.main' });
  const {
    closeCollectionRunner,
    closeCollectionSettings,
    closeFolderSettings,
    openCommandPalette,
    closeCommandPalette,
    closeAppSettings,
  } = useViewActions();

  useHotkeys([{ keys: HOTKEYS.openCommandPalette, handler: openCommandPalette }]);

  useEffect(() => {
    // Entry points of the native application menu (Collection > ...).
    RendererEventService.instance
      .on(MainProcessEvent.ShowCollectionRunner, () =>
        useViewStore.getState().openCollectionRunner()
      )
      .on(MainProcessEvent.ShowCollectionSettings, () =>
        useViewStore.getState().openCollectionSettings()
      )
      .on(MainProcessEvent.ShowAppSettings, () => useViewStore.getState().openAppSettings())
      .on(MainProcessEvent.ShowHistory, () => useViewStore.getState().setSidebarView('history'))
      .on(MainProcessEvent.HistoryChanged, (_event, payload) =>
        useHistoryStore.getState().receive(payload)
      );
    // later changes, e.g. when the collection changes, are pushed by the main process
    void useHistoryStore.getState().load();

    RendererEventService.instance
      .getAppSettings()
      .then(
        (settings) => useAppSettingsStore.getState().initialize(settings),
        // the app still starts, with the default settings
        (err) => showError('Failed to load app settings', err)
      )
      .then(() => RendererEventService.instance.emit(RendererEvent.RendererReady));
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
              <ResizablePanelGroup
                orientation="horizontal"
                className="h-full w-full"
                defaultLayout={layout.defaultLayout}
                onLayoutChanged={layout.onLayoutChanged}
              >
                <ResizablePanel id="sidebar" defaultSize="25%" minSize={MIN_SIDEBAR_PIXELS}>
                  <Menubar />
                </ResizablePanel>
                <ResizableHandle />
                <ResizablePanel id="request" defaultSize="75%" minSize={MIN_REQUEST_WINDOW_PIXELS}>
                  <RequestWindow />
                </ResizablePanel>
              </ResizablePanelGroup>
            )}
            <CollectionSettingsModal
              isOpen={isCollectionSettingsOpen}
              onClose={closeCollectionSettings}
            />
            <FolderSettingsModal folderId={folderSettingsId} onClose={closeFolderSettings} />
            <CommandPalette open={isCommandPaletteOpen} onClose={closeCommandPalette} />
            <AppSettingsModal isOpen={isAppSettingsOpen} onClose={closeAppSettings} />
          </SidebarProvider>
        </TooltipProvider>
        <Toaster />
      </ThemeProvider>
    </CollectionStoreProvider>
  );
};
