import React, { useState } from 'react';
import { SidebarHeader } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AddIcon } from '@/components/icons';
import { NamingModal } from '@/components/sidebar/SidebarRequestList/Nav/Dropdown/modals/NamingModal';
import { useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { Collection } from 'shim/objects/collection';
import { RendererEventService } from '@/services/event/renderer-event-service';

const eventService = RendererEventService.instance;
const COLLECTION_FILE_NAME = 'collection.json';

export const SidebarHeaderBar = () => {
  const { changeCollection } = useCollectionActions();
  const collection = useCollectionStore((state) => state.collection);
  const [modalState, setModalState] = useState({ isOpen: false, type: null });
  const buttonClassName = cn('flex min-w-[24px] h-[36px] p-0 items-center justify-center');

  const openModal = (type: 'request' | 'folder') => setModalState({ isOpen: true, type });

  const openCollection = async () => {
    try {
      const result = await eventService.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Collection', extensions: [COLLECTION_FILE_NAME] }],
      });
      if (!result.canceled && result.filePaths.length > 0) {
        const dirPath = result.filePaths[0].slice(0, -COLLECTION_FILE_NAME.length);
        console.info('Opening collection at', dirPath);
        changeCollection(await eventService.openCollection(dirPath));
      }
    } catch (e) {
      console.error('Error opening collection:', e);
    }
  };

  const createCollection = async () => {
    try {
      const result = await eventService.showOpenDialog({ properties: ['openDirectory'] });
      if (!result.canceled && result.filePaths.length > 0) {
        console.info('Creating collection at', result.filePaths[0]);
        changeCollection(
          await eventService.createCollection(result.filePaths[0], 'New Collection')
        );
      }
    } catch (e) {
      console.error('Error creating collection:', e);
    }
  };

  return (
    <div>
      <SidebarHeader>
        <div className="mt-2 flex w-full max-w-sm items-center space-x-[24px]">
          <Button
            className={buttonClassName}
            type="button"
            style={{ width: '100%' }}
            onClick={openCollection}
          >
            <div className={cn('m-2')}>
              <AddIcon size={24} color={'black'} />
            </div>
            <span className="overflow-hidden">Open Collection</span>
          </Button>
          <Button
            className={buttonClassName}
            type="button"
            style={{
              width: '100%',
            }}
            onClick={createCollection}
          >
            <div className={cn('m-2')}>
              <AddIcon size={24} color={'black'} />
            </div>
            <span className="overflow-hidden">New Collection</span>
          </Button>
        </div>

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
