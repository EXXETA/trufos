import { useState } from 'react';
import { SidebarHeader } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AddFolderIcon, CreateRequestIcon, SettingsIcon, SwapIcon } from '@/components/icons';
import { ArrowUpAZ, ArrowDownAZ, ClockArrowUp, ClockArrowDown } from 'lucide-react';
import { NamingModal } from '@/components/sidebar/SidebarRequestList/Nav/Dropdown/modals/NamingModal';
import { useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { Collection } from 'shim/objects/collection';
import CollectionDropdown from '@/components/sidebar/CollectionDropdown';
import { Divider } from '@/components/shared/Divider';
import { CollectionSettings } from '@/components/sidebar/CollectionSettings';
import { SortMode, SORT_CYCLE } from '@/components/sidebar/SidebarRequestList/treeUtilities';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const SORT_MODE_LABELS: Record<SortMode, string> = {
  default: 'Manual order',
  'az-asc': 'A → Z',
  'az-desc': 'Z → A',
  'time-desc': 'Recently modified',
  'time-asc': 'Oldest modified',
};

const SortIcon = ({ mode }: { mode: SortMode }) => {
  switch (mode) {
    case 'az-asc':
      return <ArrowUpAZ size={18} />;
    case 'az-desc':
      return <ArrowDownAZ size={18} />;
    case 'time-asc':
      return <ClockArrowUp size={18} />;
    case 'time-desc':
      return <ClockArrowDown size={18} />;
    default:
      return <SwapIcon size={16} viewBox="9 7 15 18" />;
  }
};

export const SidebarHeaderBar = () => {
  const collection = useCollectionStore((state) => state.collection);

  const sortMode = useCollectionStore((state) => state.sortMode);
  const { setSortMode } = useCollectionActions();

  const [creationModalState, setCreationModalState] = useState({ isOpen: false, type: null });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const buttonClassName = cn('flex h-4 w-4 items-center justify-center gap-1');

  const openModal = (type: 'request' | 'folder') => setCreationModalState({ isOpen: true, type });
  const cycleSortMode = () => {
    const currentIndex = SORT_CYCLE.indexOf(sortMode);
    setSortMode(SORT_CYCLE[(currentIndex + 1) % SORT_CYCLE.length]);
  };

  return (
    <>
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
                aria-label="Sort collection"
              >
                <SortIcon mode={sortMode} />
              </Button>
            </TooltipTrigger>
            <TooltipContent
              side="right"
              className="bg-sidebar-accent text-sidebar-accent-foreground border-0 px-2.5 py-1 text-xs font-medium tracking-wide shadow-sm"
            >
              {SORT_MODE_LABELS[sortMode]}
            </TooltipContent>
          </Tooltip>

          <div className="flex items-center gap-2">
            <Button
              className={buttonClassName}
              variant={'ghost'}
              type="button"
              size={'icon'}
              onClick={() => openModal('request')}
              aria-label="Add new request"
            >
              <CreateRequestIcon size={16} color={'secondary'} />
            </Button>

            <Button
              className={buttonClassName}
              variant={'ghost'}
              size={'icon'}
              type="button"
              onClick={() => openModal('folder')}
              aria-label="Add new folder"
            >
              <AddFolderIcon size={16} color={'secondary'} />
            </Button>

            <Button
              className={buttonClassName}
              variant={'ghost'}
              size={'icon'}
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              aria-label="Collection settings"
            >
              <SettingsIcon size={16} color={'secondary'} />
            </Button>
          </div>
        </div>
      </SidebarHeader>

      {creationModalState.isOpen && (
        <NamingModal
          trufosObject={collection as Collection}
          createType={creationModalState.type}
          onClose={() => setCreationModalState({ isOpen: false, type: null })}
        />
      )}

      <CollectionSettings
        isOpen={isSettingsOpen}
        trufosObject={collection as Collection}
        onClose={() => setIsSettingsOpen(!isSettingsOpen)}
      />
    </>
  );
};
