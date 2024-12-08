import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AddIcon } from '@/components/icons';
import React from 'react';
import { useRequestActions } from '@/state/requestStore';

export const SidebarSearch = () => {
  const { addNewRequest } = useRequestActions();

  return (
    <div className="flex w-full max-w-sm items-center space-x-[24px]">
      <Button
        className={cn('flex w-full h-[36px] p-0 items-center justify-center')}
        type="button"
        onClick={() => addNewRequest()}
      >
        <div className={cn('m-2')}>
          <AddIcon size={24} color={'black'} />
        </div>
        <span>Create New Request</span>
      </Button>
    </div>
  );
};
