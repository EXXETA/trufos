import React, { useState } from 'react';
import { SidebarHeader } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AddIcon } from '@/components/icons';
import { NamingModal } from '@/components/sidebar/SidebarRequestList/Nav/Dropdown/modals/NamingModal';
import { useCollectionStore } from '@/state/collectionStore';
import { Collection } from 'shim/objects/collection';
import CollectionDropdown from '@/components/sidebar/CollectionDropdown';

export const SidebarHeaderBar = () => {
  const collection = useCollectionStore((state) => state.collection);
  const [modalState, setModalState] = useState({ isOpen: false, type: null });
  const buttonClassName = cn('flex min-w-[24px] h-[36px] p-0 items-center justify-center');

  const openModal = (type: 'request' | 'folder') => setModalState({ isOpen: true, type });

  return (
    <div>
      <SidebarHeader>
        <CollectionDropdown />

        <div className="mt-2 flex w-full max-w-sm items-center space-x-[24px]">
          <Button
            className={buttonClassName}
            type="button"
            style={{ width: '100%' }}
            onClick={() => openModal('folder')}
          >
            <div className={cn('m-2')}>
              <AddIcon size={24} color={'black'} />
            </div>
            <span className="overflow-hidden">New Folder</span>
          </Button>
          <Button
            className={buttonClassName}
            type="button"
            style={{
              width: '100%',
            }}
            onClick={() => openModal('request')}
          >
            <div className={cn('m-2')}>
              <AddIcon size={24} color={'black'} />
            </div>
            <span className="overflow-hidden">New Request</span>
          </Button>
        </div>
      </SidebarHeader>
      {modalState.isOpen && (
        <NamingModal
          isOpen={modalState.isOpen}
          trufosObject={collection as Collection}
          createType={modalState.type}
          setOpen={(open) => setModalState({ isOpen: open, type: modalState.type })}
        />
      )}
    </div>
  );
};
