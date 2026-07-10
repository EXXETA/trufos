import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AddIcon } from '@/components/icons';
import { useCollectionActions } from '@/state/collectionStore';

export const SidebarSearch = () => {
  const { addNewRequest } = useCollectionActions();

  return (
    <div className="flex w-full max-w-sm items-center space-x-[24px]">
      <Button
        className="flex h-[36px] min-w-[36px] items-center justify-center p-0"
        type="button"
        style={{
          width: '100%',
        }}
        onClick={() => addNewRequest()}
      >
        <div className={cn('m-2')}>
          <AddIcon size={24} color={'black'} />
        </div>
        <span className="overflow-hidden">Create New Request</span>
      </Button>
    </div>
  );
};
