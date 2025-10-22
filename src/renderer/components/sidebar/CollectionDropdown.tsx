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
import { RendererEventService } from '@/services/event/renderer-event-service';
import { CollectionBase } from 'shim/objects/collection';
import { cn } from '@/lib/utils';
import { CollectionIcon, SmallArrow, CloseIcon } from '@/components/icons';
import { FolderOpen, FolderPlus, Upload } from 'lucide-react';
import { TypographyLineClamp } from '@/components/shared/TypographyLineClamp';
import { CollectionImport } from '@/view/CollectionImport';

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
  }, [isOpen]);

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
        const title = result?.filePaths[0].split('\\').slice(-1)[0];

        console.info('Creating collection at', result.filePaths[0]);
        await changeCollection(await eventService.createCollection(result.filePaths[0], title));
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
                'flex h-6 w-6 items-center justify-center rounded-md text-popover-foreground opacity-0',
                'hover:bg-popover hover:text-popover-foreground hover:opacity-100'
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
        <Button variant="secondary" className={cn('flex justify-between border-0')}>
          <TypographyLineClamp>{collection?.title}</TypographyLineClamp>

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
        className={cn(
          'w-[var(--radix-dropdown-menu-trigger-width)]',
          'border border-border bg-background-secondary p-0',
          'max-h-[75vh] overflow-hidden'
        )}
      >
        <div className="sticky top-0 z-10 bg-background-secondary">
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
        </div>

        <div className="tabs-scrollbar max-h-[calc(75vh-102px)] overflow-y-auto">
          <DropdownMenuGroup>
            {/*{collections.map(({*/}
            {/*  title,*/}
            {/*  dirPath*/}
            {/*}, i) => (<DropdownMenuItem*/}
            {/*    key={`${title}-${i}`}*/}
            {/*    onClick={() => changeCollection(dirPath)}*/}
            {/*    className={cn('flex px-4 py-3', collection?.dirPath === dirPath && 'bg-divider')}*/}
            {/*  >*/}
            {/*    <CollectionIcon size={16} color="secondary" />*/}

            {/*    <div className="grid items-start gap-0">*/}
            {/*      <TypographyLineClamp contentClassname="text-xs">{title}</TypographyLineClamp>*/}

            {/*      <TypographyLineClamp contentClassname="text-[8px]">{dirPath}</TypographyLineClamp>*/}
            {/*    </div>*/}
            {/*  </DropdownMenuItem>))}*/}
            {renderCollectionList()}
          </DropdownMenuGroup>
        </div>
        {showImport && <CollectionImport onClose={() => setShowImport(false)} />}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
