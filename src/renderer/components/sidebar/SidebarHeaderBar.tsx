import { useState } from 'react';
import { SidebarHeader } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AddIcon } from '@/components/icons';
import { NamingModal } from '@/components/sidebar/SidebarRequestList/Nav/Dropdown/modals/NamingModal';
import { useCollectionStore } from '@/state/collectionStore';
import { Collection } from 'shim/objects/collection';
import CollectionDropdown from '@/components/sidebar/CollectionDropdown';
import { FolderPlus } from 'lucide-react';
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
            <div className="flex h-6 w-6 items-center">
              <FolderPlus size={24} color={'black'} />
            </div>

            <span className="hidden md:block">New Folder</span>
          </Button>

          <Button className={buttonClassName} type="button" onClick={() => openModal('request')}>
            <div className="flex h-6 w-6 items-center">
              <AddIcon size={24} color={'black'} />
            </div>

            <span className="hidden md:block">New Request</span>
          </Button>
        </div>
      </SidebarHeader>

      {modalState.isOpen && (
        <NamingModal
          trufosObject={collection as Collection}
          createType={modalState.type}
          onClose={() => setModalState({ isOpen: false, type: null })}
        />
      )}
    </div>
  );
};
