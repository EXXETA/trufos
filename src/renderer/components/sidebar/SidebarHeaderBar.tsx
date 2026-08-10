import { useTranslation } from 'react-i18next';
import { SidebarHeader } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AddFolderIcon, CreateRequestIcon, SettingsIcon, SwapIcon } from '@/components/icons';
import { ArrowUpAZ, ArrowDownAZ, ClockArrowUp, ClockArrowDown } from 'lucide-react';

import { useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { selectIsCommandPaletteOpen, useViewActions, useViewStore } from '@/state/viewStore';
import CollectionDropdown from '@/components/sidebar/CollectionDropdown';
import { Divider } from '@/components/shared/Divider';
import { SortMode, SORT_CYCLE } from '@/components/sidebar/SidebarRequestList/treeUtilities';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { CreatingItem } from '@/components/sidebar/SidebarRequestList/types';
import { useHotkeys } from '@/hooks/hotKeys/useHotkey';
import { HOTKEYS } from '@/hooks/hotKeys/hotkeys';

const SORT_MODE_LABEL_KEYS = {
  [SortMode.DEFAULT]: 'sidebar.sort.manual',
  [SortMode.AZ_ASC]: 'sidebar.sort.azAsc',
  [SortMode.AZ_DESC]: 'sidebar.sort.azDesc',
  [SortMode.TIME_DESC]: 'sidebar.sort.timeDesc',
  [SortMode.TIME_ASC]: 'sidebar.sort.timeAsc',
} as const satisfies Record<SortMode, string>;

const SortIcon = ({ mode }: { mode: SortMode }) => {
  switch (mode) {
    case SortMode.AZ_ASC:
      return <ArrowUpAZ size={18} />;
    case SortMode.AZ_DESC:
      return <ArrowDownAZ size={18} />;
    case SortMode.TIME_ASC:
      return <ClockArrowUp size={18} />;
    case SortMode.TIME_DESC:
      return <ClockArrowDown size={18} />;
    default:
      return <SwapIcon size={16} viewBox="9 7 15 18" />;
  }
};

interface SidebarHeaderBarProps {
  onCreateItem: (item: CreatingItem) => void;
}

export const SidebarHeaderBar = ({ onCreateItem }: SidebarHeaderBarProps) => {
  const { t } = useTranslation();
  const collection = useCollectionStore((state) => state.collection);

  const sortMode = useCollectionStore((state) => state.sortMode);
  const { setSortMode } = useCollectionActions();
  const { openCollectionSettings } = useViewActions();
  const isCommandPaletteOpen = useViewStore(selectIsCommandPaletteOpen);

  const buttonClassName = cn('flex h-4 w-4 items-center justify-center gap-1');

  const openModal = (type: 'request' | 'folder') => {
    if (collection?.id) {
      onCreateItem({ type, parentId: collection.id });
    }
  };
  const cycleSortMode = () => {
    const currentIndex = SORT_CYCLE.indexOf(sortMode);
    setSortMode(SORT_CYCLE[(currentIndex + 1) % SORT_CYCLE.length]);
  };

  // Disabled while the Command Palette is open — it owns this same shortcut then; see
  // CommandPalette.tsx's own useHotkeys call.
  useHotkeys([{ keys: HOTKEYS.newRequest, handler: () => openModal('request') }], {
    enabled: !isCommandPaletteOpen,
  });

  return (
    <SidebarHeader className="flex-col gap-6">
      <CollectionDropdown />

      <Divider />

      <div className="-mt-4 mb-2 flex w-full items-center justify-between">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className={cn(buttonClassName, 'text-text-secondary ml-3')}
              variant={'ghost'}
              type="button"
              size={'icon'}
              onClick={cycleSortMode}
              aria-label={t('sidebar.sortCollection')}
            >
              <SortIcon mode={sortMode} />
            </Button>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            className="bg-sidebar-accent text-sidebar-accent-foreground border-0 px-2.5 py-1 text-xs font-medium tracking-wide shadow-sm"
          >
            {t(SORT_MODE_LABEL_KEYS[sortMode])}
          </TooltipContent>
        </Tooltip>

        <div className="flex items-center gap-2">
          <Button
            className={buttonClassName}
            variant={'ghost'}
            type="button"
            size={'icon'}
            onClick={() => openModal('request')}
            aria-label={t('sidebar.addRequest')}
          >
            <CreateRequestIcon size={16} color={'secondary'} />
          </Button>

          <Button
            className={buttonClassName}
            variant={'ghost'}
            size={'icon'}
            type="button"
            onClick={() => openModal('folder')}
            aria-label={t('sidebar.addFolder')}
          >
            <AddFolderIcon size={16} color={'secondary'} />
          </Button>

          <Button
            className={buttonClassName}
            variant={'ghost'}
            size={'icon'}
            type="button"
            onClick={openCollectionSettings}
            aria-label={t('sidebar.collectionSettings')}
          >
            <SettingsIcon size={16} color={'secondary'} />
          </Button>
        </div>
      </div>
    </SidebarHeader>
  );
};
