import { History as HistoryIcon } from 'lucide-react';
import { SidebarHeader } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SettingsIcon } from '@/components/icons';
import { useCollectionStore } from '@/state/collectionStore';
import {
  selectIsCommandPaletteOpen,
  selectSidebarView,
  useViewActions,
  useViewStore,
} from '@/state/viewStore';
import CollectionDropdown from '@/components/sidebar/CollectionDropdown';
import { Divider } from '@/components/shared/Divider';
import { useHotkeys } from '@/hooks/hotKeys/useHotkey';
import { HOTKEYS } from '@/hooks/hotKeys/hotkeys';
import { RequestsToolbar } from './RequestsToolbar';
import { HistoryToolbar } from './HistoryToolbar';
import { SIDEBAR_ICON_BUTTON_CLASS } from './sidebar-toolbar';

export const SidebarHeaderBar = () => {
  const collection = useCollectionStore((state) => state.collection);
  const { openCollectionSettings, setSidebarView, requestCreateItem } = useViewActions();
  const isCommandPaletteOpen = useViewStore(selectIsCommandPaletteOpen);
  const sidebarView = useViewStore(selectSidebarView);

  const create = (type: 'request' | 'folder') => {
    if (collection?.id) requestCreateItem({ type, parentId: collection.id });
  };
  const toggleHistory = () => setSidebarView(sidebarView === 'history' ? 'requests' : 'history');

  // Disabled while the Command Palette is open — it owns this same shortcut then; see
  // CommandPalette.tsx's own useHotkeys call.
  useHotkeys([{ keys: HOTKEYS.newRequest, handler: () => create('request') }], {
    enabled: !isCommandPaletteOpen,
  });

  // the actions of both sidebar views
  const trailing = (
    <>
      <Button
        className={cn(
          SIDEBAR_ICON_BUTTON_CLASS,
          sidebarView === 'history' ? 'text-accent-primary' : 'text-text-secondary'
        )}
        variant={'ghost'}
        size={'icon'}
        type="button"
        onClick={toggleHistory}
        aria-label="Request history"
        aria-pressed={sidebarView === 'history'}
      >
        <HistoryIcon size={16} />
      </Button>

      <Button
        className={SIDEBAR_ICON_BUTTON_CLASS}
        variant={'ghost'}
        size={'icon'}
        type="button"
        onClick={openCollectionSettings}
        aria-label="Collection settings"
      >
        <SettingsIcon size={16} color={'secondary'} />
      </Button>
    </>
  );

  return (
    <SidebarHeader className="flex-col gap-6">
      <CollectionDropdown />

      <Divider />

      <div className="-mt-4 mb-2 flex w-full items-center justify-between">
        {sidebarView === 'requests' ? (
          <RequestsToolbar onCreate={create} trailing={trailing} />
        ) : (
          <HistoryToolbar trailing={trailing} />
        )}
      </div>
    </SidebarHeader>
  );
};
