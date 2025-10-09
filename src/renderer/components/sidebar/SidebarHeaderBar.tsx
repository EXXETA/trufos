import { useState } from 'react';
import { SidebarHeader } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AddFolderIcon, CreateRequestIcon } from '@/components/icons';
import { NamingModal } from '@/components/sidebar/SidebarRequestList/Nav/Dropdown/modals/NamingModal';
import { useCollectionStore } from '@/state/collectionStore';
import { Collection } from 'shim/objects/collection';
import CollectionDropdown from '@/components/sidebar/CollectionDropdown';
import { Divider } from '@/components/shared/Divider';
import { SettingsModal } from '@/components/shared/settings/SettingsModal';
export const SidebarHeaderBar = () => {
  const collection = useCollectionStore((state) => state.collection);
  const [modalState, setModalState] = useState({ isOpen: false, type: null });
  const buttonClassName = cn('flex h-4 w-4 items-center justify-center gap-1');

  const openModal = (type: 'request' | 'folder') => setModalState({ isOpen: true, type });

  return (
    <>
      <SidebarHeader className="flex-col gap-6">
        <CollectionDropdown />

        {/* TODO: 3) new settings button (should contain collection settings as rename, delete etc.) */}

        <Divider />

        <div className="-mt-4 mb-2 flex w-full items-center justify-end gap-2">
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

          {/*<CollectionSettings />*/}
        </div>
      </SidebarHeader>

      {modalState.isOpen && (
        <NamingModal
          trufosObject={collection as Collection}
          createType={modalState.type}
          onClose={() => setModalState({ isOpen: false, type: null })}
        />
      )}
    </>
  );
};
