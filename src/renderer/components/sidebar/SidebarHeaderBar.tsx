import React from 'react';
import { SidebarHeader } from '@/components/ui/sidebar';
import { useCollectionActions } from '@/state/collectionStore';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AddIcon } from '@/components/icons';

export const SidebarHeaderBar = () => {
  const { addNewRequest } = useCollectionActions();
  return (
    <SidebarHeader>
      <div className="flex w-full max-w-sm items-center space-x-[24px]">
        <Button
          className={cn('flex min-w-[36px] h-[36px] p-0 items-center justify-center')}
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
    </SidebarHeader>
  );
};
