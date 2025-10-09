import { useCallback, useEffect, useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  // DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import CollectionImport from '@/view/CollectionImport';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { CollectionBase } from 'shim/objects/collection';
import { cn } from '@/lib/utils';
import { CollectionIcon, SmallArrow } from '@/components/icons';
import { FolderOpen, FolderPlus, Upload } from 'lucide-react';
import { CloseIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

const eventService = RendererEventService.instance;

export default function CollectionDropdown() {
  const { changeCollection } = useCollectionActions();
  const collection = useCollectionStore((state) => state.collection);
  const [collections, setCollections] = useState<CollectionBase[]>([]);
  const [isOpen, setIsOpen] = useState(false);
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
          <p className="flex-1 pr-2">{title}</p>
          {i !== 0 && (
            <button
              onClick={async (e) => {
                e.stopPropagation();
                await eventService.closeCollection(dirPath);
                setCollections((prev) => prev.filter((c) => c.dirPath !== dirPath));
              }}
              className={cn(
                'text-popover-foreground flex h-6 w-6 items-center justify-center rounded-md opacity-0',
                'hover:text-popover-foreground hover:bg-popover hover:opacity-100'
              )}
            >
              <CloseIcon size={24} />
            </button>
          )}
        </DropdownMenuRadioItem>
      )),
    [collections]
  );

  return (
    <DropdownMenu onOpenChange={() => setIsOpen(!isOpen)}>
      <DropdownMenuTrigger asChild>
        {/* TODO: Button should render collection name dynamically. If no created yet - Default collection */}
        <Button variant="secondary" className={cn('flex justify-between', 'border-0')}>
          <p>{collection?.title}</p>

          <div
            className={cn(
              'transition-transform duration-300 ease-in-out',
              isOpen ? 'rotate-180' : 'rotate-0'
            )}
          >
            <SmallArrow />
          </div>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className={
          'w-[var(--radix-dropdown-menu-trigger-width)] border border-border bg-background-secondary p-0'
        }
      >
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={createCollection} className={'px-4 py-3'}>
            <FolderPlus />
            <span>New Collection</span>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={openCollection} className={'px-4 py-3'}>
            <FolderOpen />
            <span>Open Collection</span>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setShowImport(true)}>
            <Upload />
            <span>Import Collection</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

          <DropdownMenuSeparator />

        {/* TODO: collection title should be rendered automatically from single source of truth */}
        <DropdownMenuGroup>
          {collections.map(({ title, dirPath }, i) => {
            const collectionTitle = i === 0 ? title : dirPath.split('\\').slice(-1);

            return (
              <DropdownMenuItem
                key={`${title}-${i}`}
                onClick={() => loadCollections(dirPath)}
                className={`flex ${collection?.dirPath === dirPath ? 'bg-divider' : ''}`}
              >
                <CollectionIcon size={16} color={'secondary'} />

                <div className="flex flex-col items-start gap-0">
                  <span className="text-xs">{collectionTitle}</span>

                  <span className="text-[8px]">{dirPath}</span>
                </div>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
