import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { useCallback, useEffect, useState } from 'react';
import { CollectionBase, CollectionType } from 'shim/objects/collection';
import { FolderOpen, FolderPlus, FileDown } from 'lucide-react';

const IMPORT_DIALOG_OPTIONS = new Map<CollectionType, Electron.OpenDialogOptions>([
  [
    CollectionType.Postman,
    {
      properties: ['openFile'],
      filters: [{ name: 'Postman Collection', extensions: ['json'] }],
    },
  ],
  [
    CollectionType.Bruno,
    {
      properties: ['openDirectory'],
      title: 'Select Bruno Collection Directory',
    },
  ],
]);

const eventService = RendererEventService.instance;

export default function CollectionDropdown() {
  const { changeCollection } = useCollectionActions();
  const collection = useCollectionStore((state) => state.collection);
  const [collections, setCollections] = useState<CollectionBase[]>([]);

  const loadCollections = useCallback(async () => {
    setCollections(await eventService.listCollections());
  }, [setCollections]);

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  const loadCollection = useCallback(
    async (dirPath: string) => {
      console.info('Opening collection at', dirPath);
      changeCollection(await eventService.openCollection(dirPath));
    },
    [changeCollection]
  );

  const openCollection = useCallback(async () => {
    try {
      const result = await eventService.showOpenDialog({
        title: 'Open Collection Directory',
        buttonLabel: 'Open',
        properties: ['openDirectory'],
      });
      if (!result.canceled && result.filePaths.length > 0) {
        await loadCollection(result.filePaths[0]);
      }
      await loadCollections();
    } catch (e) {
      console.error('Error opening collection:', e);
    }
  }, [loadCollection]);

  const createCollection = useCallback(async () => {
    try {
      const result = await eventService.showOpenDialog({
        title: 'Create New Collection Directory',
        buttonLabel: 'Create',
        properties: ['openDirectory', 'createDirectory'],
      });
      if (!result.canceled && result.filePaths.length > 0) {
        console.info('Creating collection at', result.filePaths[0]);
        changeCollection(
          await eventService.createCollection(result.filePaths[0], 'New Collection')
        );
      }
      await loadCollections();
    } catch (e) {
      console.error('Error creating collection:', e);
    }
  }, [changeCollection]);

  const handleImport = useCallback(
    async (strategy: CollectionType) => {
      try {
        let info = await eventService.showOpenDialog(IMPORT_DIALOG_OPTIONS.get(strategy));
        if (info.canceled || info.filePaths.length === 0) return;
        const srcFilePath = info.filePaths[0];

        info = await eventService.showOpenDialog({
          properties: ['openDirectory'],
          title: 'Select empty target Directory',
        });
        if (info.canceled || info.filePaths.length === 0) return;
        const targetDirPath = info.filePaths[0];

        console.info(
          'Importing collection from',
          srcFilePath,
          'to',
          targetDirPath,
          'using strategy',
          strategy
        );
        changeCollection(await eventService.importCollection(srcFilePath, targetDirPath, strategy));
        await loadCollections();
      } catch (error) {
        console.error('Error importing collection:', error);
      }
    },
    [changeCollection, loadCollections]
  );

  const renderCollectionList = useCallback(
    () =>
      collections.map(({ title, dirPath }, i) => (
        <DropdownMenuRadioItem key={i} value={dirPath}>
          {title}
        </DropdownMenuRadioItem>
      )),
    [collections, changeCollection]
  );

  return (
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
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <FileDown />
              <span>Import</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuContent side="right" align="start">
                {Array.from(IMPORT_DIALOG_OPTIONS.keys()).map((strategy) => (
                  <DropdownMenuItem key={String(strategy)} onClick={() => handleImport(strategy)}>
                    {String(strategy)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={collection.dirPath} onValueChange={loadCollection}>
          {renderCollectionList()}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
