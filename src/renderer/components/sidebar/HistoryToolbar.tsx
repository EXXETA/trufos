import { ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { selectHistoryEntries, useHistoryActions, useHistoryStore } from '@/state/historyStore';
import { SIDEBAR_ICON_BUTTON_CLASS } from './sidebar-toolbar';

export interface HistoryToolbarProps {
  /** Actions shown after the toolbar's own ones, e.g. the ones of both sidebar views. */
  trailing: ReactNode;
}

/** The actions of the request history: how many requests it holds and clearing it. */
export const HistoryToolbar = ({ trailing }: HistoryToolbarProps) => {
  const count = useHistoryStore((state) => selectHistoryEntries(state).length);
  const { clear } = useHistoryActions();

  return (
    <>
      <span className="text-text-secondary ml-3 text-xs">
        {count} {count === 1 ? 'request' : 'requests'} in this session
      </span>

      <div className="flex items-center gap-2">
        <Button
          className={cn(SIDEBAR_ICON_BUTTON_CLASS, 'text-text-secondary')}
          variant={'ghost'}
          size={'icon'}
          type="button"
          disabled={count === 0}
          onClick={clear}
          aria-label="Clear history"
        >
          <Trash2 size={16} />
        </Button>

        {trailing}
      </div>
    </>
  );
};
