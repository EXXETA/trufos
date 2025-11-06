import { useState } from 'react';
import { SidebarHeader } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AddFolderIcon, CreateRequestIcon, SettingsIcon } from '@/components/icons';
import { NamingModal } from '@/components/sidebar/SidebarRequestList/Nav/Dropdown/modals/NamingModal';
import { useCollectionStore } from '@/state/collectionStore';
import { Collection } from 'shim/objects/collection';
import CollectionDropdown from '@/components/sidebar/CollectionDropdown';
import { Divider } from '@/components/shared/Divider';
import { CollectionSettings } from '@/components/sidebar/CollectionSettings';

export const SidebarHeaderBar = () => {
  const collection = useCollectionStore((state) => state.collection);

  const [creationModalState, setCreationModalState] = useState({ isOpen: false, type: null });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const buttonClassName = cn('flex h-4 w-4 items-center justify-center gap-1');

  const openModal = (type: 'request' | 'folder') => setCreationModalState({ isOpen: true, type });

  return (
    <>
      <SidebarHeader className="flex-col gap-6">
        <CollectionDropdown />

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

          <Button
            className={buttonClassName}
            variant={'ghost'}
            size={'icon'}
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            aria-label="Add new folder"
          >
            <SettingsIcon size={16} color={'secondary'} />
          </Button>
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
