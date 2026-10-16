import { ReactNode } from 'react';
import { ArrowUpAZ, ArrowDownAZ, ClockArrowUp, ClockArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AddFolderIcon, CreateRequestIcon, SwapIcon } from '@/components/icons';
import { cn } from '@/lib/utils';
import { useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { SortMode, SORT_CYCLE } from '@/state/interface/SortMode';
import { SIDEBAR_ICON_BUTTON_CLASS } from './sidebar-toolbar';

const SORT_MODE_LABELS: Record<SortMode, string> = {
  [SortMode.DEFAULT]: 'Manual order',
  [SortMode.AZ_ASC]: 'A → Z',
  [SortMode.AZ_DESC]: 'Z → A',
  [SortMode.TIME_DESC]: 'Recently modified',
  [SortMode.TIME_ASC]: 'Oldest modified',
};

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

export interface RequestsToolbarProps {
  /** Creates a request or folder at the top level of the collection. */
  onCreate: (type: 'request' | 'folder') => void;
  /** Actions shown after the toolbar's own ones, e.g. the ones of both sidebar views. */
  trailing: ReactNode;
}

/** The actions of the request tree: sorting it and adding requests and folders. */
export const RequestsToolbar = ({ onCreate, trailing }: RequestsToolbarProps) => {
  const sortMode = useCollectionStore((state) => state.sortMode);
  const { setSortMode } = useCollectionActions();

  const cycleSortMode = () => {
    const currentIndex = SORT_CYCLE.indexOf(sortMode);
    setSortMode(SORT_CYCLE[(currentIndex + 1) % SORT_CYCLE.length]);
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            className={cn(SIDEBAR_ICON_BUTTON_CLASS, 'text-text-secondary ml-3')}
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
          className={SIDEBAR_ICON_BUTTON_CLASS}
          variant={'ghost'}
          type="button"
          size={'icon'}
          onClick={() => onCreate('request')}
          aria-label="Add new request"
        >
          <CreateRequestIcon size={16} color={'secondary'} />
        </Button>

        <Button
          className={SIDEBAR_ICON_BUTTON_CLASS}
          variant={'ghost'}
          size={'icon'}
          type="button"
          onClick={() => onCreate('folder')}
          aria-label="Add new folder"
        >
          <AddFolderIcon size={16} color={'secondary'} />
        </Button>

        {trailing}
      </div>
    </>
  );
};
