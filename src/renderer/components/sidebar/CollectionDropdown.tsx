import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { useCallback, useEffect, useState } from 'react';
import { CollectionBase } from 'shim/objects/collection';

const eventService = RendererEventService.instance;
const COLLECTION_FILE_NAME = 'collection.json';

export default function CollectionDropdown() {
  const { changeCollection } = useCollectionActions();
  const collection = useCollectionStore((state) => state.collection);
  const [collections, setCollections] = useState<CollectionBase[]>([]);

  useEffect(() => {
    eventService.listCollections().then(setCollections);
  }, []);

  const openCollection = useCallback(async () => {
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
  }, [changeCollection]);

  const createCollection = useCallback(async () => {
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
  }, [changeCollection]);

  const renderCollectionList = useCallback(
    () =>
      collections.map(({ title, dirPath }, i) => (
        <DropdownMenuItem
          key={i}
          onClick={async () => {
            console.info('Opening collection at', dirPath);
            changeCollection(await eventService.openCollection(dirPath));
          }}
        >
          <span>{title}</span>
        </DropdownMenuItem>
      )),
    [collections, changeCollection]
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">{collection.title}</Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent>
        <DropdownMenuLabel>Collection</DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem onClick={createCollection}>
            <span>New Collection</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={openCollection}>
            <span>Open Collection</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>{renderCollectionList()}</DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
