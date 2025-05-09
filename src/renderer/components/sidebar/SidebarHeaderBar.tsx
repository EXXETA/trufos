import React, { useState } from 'react';
import { SidebarHeader } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AddIcon, NewFolderIcon } from '@/components/icons';
import { NamingModal } from '@/components/sidebar/SidebarRequestList/Nav/Dropdown/modals/NamingModal';
import { useCollectionStore } from '@/state/collectionStore';
import { Collection } from 'shim/objects/collection';
import CollectionDropdown from '@/components/sidebar/CollectionDropdown';

export const SidebarHeaderBar = () => {
  const collection = useCollectionStore((state) => state.collection);
  const [modalState, setModalState] = useState({ isOpen: false, type: null });
  const buttonClassName = cn('flex w-full min-w-[24px] h-[36px] items-center justify-center gap-1');

  const openModal = (type: 'request' | 'folder') => setModalState({ isOpen: true, type });

  return (
    <div>
      <SidebarHeader className="flex-col gap-4">
        <CollectionDropdown />

        <div className="flex w-full items-center gap-6">
          <Button className={buttonClassName} type="button" onClick={() => openModal('folder')}>
            <div className="flex items-center h-6 w-6">
              <NewFolderIcon size={24} color={'black'} />
            </div>

            <span className="hidden md:block">New Folder</span>
          </Button>

          <Button className={buttonClassName} type="button" onClick={() => openModal('request')}>
            <div className="flex items-center h-6 w-6">
              <AddIcon size={24} color={'black'} />
            </div>

            <span className="hidden md:block">New Request</span>
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
