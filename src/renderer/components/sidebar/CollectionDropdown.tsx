import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import CollectionImport from '@/view/CollectionImport';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { useCallback, useEffect, useState } from 'react';
import { CollectionBase } from 'shim/objects/collection';
import { FolderOpen, FolderPlus, Upload } from 'lucide-react';
import { CloseIcon } from '@/components/icons';

const eventService = RendererEventService.instance;

export default function CollectionDropdown() {
  const { changeCollection } = useCollectionActions();
  const collection = useCollectionStore((state) => state.collection);
  const [collections, setCollections] = useState<CollectionBase[]>([]);
  const [showImport, setShowImport] = useState(false);

  const loadCollections = useCallback(async () => {
    setCollections(await eventService.listCollections());
  }, [setCollections]);

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  const openCollection = useCallback(async () => {
    try {
      const result = await eventService.showOpenDialog({
        title: 'Open Collection Directory',
        buttonLabel: 'Open',
        properties: ['openDirectory'],
      });
      if (!result.canceled && result.filePaths.length > 0) {
        await changeCollection(result.filePaths[0]);
      }
      await loadCollections();
    } catch (e) {
      console.error('Error opening collection:', e);
    }
  }, []);

  const createCollection = useCallback(async () => {
    try {
      const result = await eventService.showOpenDialog({
        title: 'Create New Collection Directory',
        buttonLabel: 'Create',
        properties: ['openDirectory', 'createDirectory'],
      });
      if (!result.canceled && result.filePaths.length > 0) {
        console.info('Creating collection at', result.filePaths[0]);
        await changeCollection(
          await eventService.createCollection(result.filePaths[0], 'New Collection')
        );
      }
      await loadCollections();
    } catch (e) {
      console.error('Error creating collection:', e);
    }
  }, []);

  const renderCollectionList = useCallback(
    () =>
      collections.map(({ title, dirPath }, i) => (
        <DropdownMenuRadioItem key={i} value={dirPath}>
          <button
            onClick={async (e) => {
              e.stopPropagation();
              await eventService.closeCollection(dirPath);
              setCollections((prev) => prev.filter((c) => c.dirPath !== dirPath));
            }}
            className="text-muted-foreground hover:text-destructive flex h-6 w-6 items-center justify-center"
          >
            <CloseIcon size={24} />
          </button>
          <span>{title}</span>
        </DropdownMenuRadioItem>
      )),
    [collections]
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">Switch Collection</Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent>
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={createCollection}>
              <FolderPlus />
              <span>New Collection</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={openCollection}>
              <FolderOpen />
              <span>Open Collection</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowImport(true)}>
              <Upload />
              <span>Import Collection</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuRadioGroup value={collection.dirPath} onValueChange={changeCollection}>
            {renderCollectionList()}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {showImport && <CollectionImport onClose={() => setShowImport(false)} />}
    </>
  );
}
