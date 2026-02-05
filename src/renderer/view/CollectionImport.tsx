import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { useStateResettable } from '@/util/react-util';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { useCollectionActions } from '@/state/collectionStore';
import { Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import FilePicker from '@/components/ui/file-picker';
import { DroppedEntryInfo } from '@/components/ui/file-drop-zone';
import { FolderPlusIcon, FolderSearchIcon } from '@/components/icons';
import { ImportStrategy } from 'shim/event-service';
import { showError } from '@/error/errorHandler';
import { Collection } from 'shim/objects/collection';

const eventService = RendererEventService.instance;

declare type ImportStrategyWithTrufos = ImportStrategy | 'Trufos';

interface TitleInputProps {
  value: string;
  onChange: (value: string) => void;
}

const TitleInput: React.FC<TitleInputProps> = ({ value, onChange }) => {
  return (
    <div className="flex flex-col gap-2">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Name of the new collection"
        className="rounded-lg"
      />
    </div>
  );
};

const ImportTabsContent: React.FC<{
  children: React.ReactNode;
  strategy: ImportStrategyWithTrufos;
  /** Whether to include default vertical spacing (gap) */
  gap?: boolean;
}> = ({ children, strategy, gap = true }) => {
  return (
    <TabsContent
      value={strategy}
      className="min-h-0 flex-1 overflow-auto rounded-none bg-transparent"
    >
      <div
        className={cn('flex flex-col pr-2', {
          'gap-6': gap,
        })}
      >
        {children}
      </div>
    </TabsContent>
  );
};

export const CollectionImport: React.FC<{ onClose?: () => void; open?: boolean }> = ({
  onClose,
  open = true,
}) => {
  const { changeCollection } = useCollectionActions();

  const [strategy, setStrategy] = useState<ImportStrategyWithTrufos>('Trufos');
  const [srcEntry, setSrcEntry, resetSrcEntry] = useStateResettable<DroppedEntryInfo>();
  const [targetEntry, setTargetEntry, resetTargetEntry] = useStateResettable<DroppedEntryInfo>();
  const [title, setTitle, resetTitle] = useStateResettable('');
  const [isImporting, setIsImporting, resetIsImporting] = useStateResettable(false);

  const canImport =
    srcEntry &&
    (strategy === 'Trufos' || (targetEntry != null && title.trim() !== '')) &&
    !isImporting;

  useEffect(() => {
    if (open) {
      resetSrcEntry();
      resetTargetEntry();
      resetTitle();
      resetIsImporting();
    }
  }, [open, strategy]);

  const doImport = useCallback(async () => {
    try {
      setIsImporting(true);
      let collection: Collection;
      if (strategy === 'Trufos') {
        collection = await eventService.openCollection(srcEntry.path);
      } else {
        collection = await eventService.importCollection(
          srcEntry.path,
          targetEntry.path,
          strategy,
          title
        );
      }
      await changeCollection(collection);
      onClose?.();
    } catch (e) {
      showError(e);
    } finally {
      setIsImporting(false);
    }
  }, [srcEntry, targetEntry, strategy, title, onClose, changeCollection]);

  const dialogFooter = useMemo(() => {
    if (strategy === 'Bruno' || strategy === 'Insomnia') {
      return null;
    }
    return (
      <DialogFooter className="mt-2 justify-center gap-2 sm:justify-center">
        <div className="flex w-full justify-center">
          <Button onClick={doImport} disabled={!canImport} className="gap-2 font-bold">
            <Plus size={16} />
            {isImporting
              ? 'Importing...'
              : strategy === 'Trufos'
                ? 'Open Collection'
                : 'Complete Import'}
          </Button>
        </div>
      </DialogFooter>
    );
  }, [strategy, doImport, canImport, isImporting]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="flex max-h-[90vh] w-[760px] max-w-3xl flex-col border-none shadow-none">
        <DialogHeader>
          <DialogTitle>Import Collection</DialogTitle>
        </DialogHeader>

        <Tabs
          value={strategy}
          onValueChange={(v) => setStrategy(v as ImportStrategy)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList className="mt-1 mb-2 ml-0.5 overflow-visible">
            <TabsTrigger value="Trufos">Trufos</TabsTrigger>
            <TabsTrigger value="Postman">Postman</TabsTrigger>
            <TabsTrigger value="Bruno">Bruno</TabsTrigger>
            <TabsTrigger value="Insomnia">Insomnia</TabsTrigger>
          </TabsList>

          <ImportTabsContent strategy="Trufos">
            <FilePicker
              title="Select directory of the existing collection"
              description="Select the folder containing the collection.json file"
              entry={srcEntry}
              icon={<FolderSearchIcon size={36} />}
              onFileSelected={setSrcEntry}
              onFileRemoved={() => setSrcEntry(undefined)}
              directoryMode
              controlled
            />
          </ImportTabsContent>

          <ImportTabsContent strategy="Postman">
            <FilePicker
              title="Select file of the original collection"
              description="Postman exports .json files"
              entry={srcEntry}
              icon={<FolderSearchIcon size={36} />}
              onFileSelected={setSrcEntry}
              onFileRemoved={() => setSrcEntry(undefined)}
              accept=".json"
              controlled
            />
            {/* Flow separator */}
            <div className="flex items-center justify-center">
              <div className="bg-separator h-px flex-1" />
              <div className="border-t-separator mx-5 h-0 w-0 border-x-[6px] border-t-8 border-x-transparent" />
              <div className="bg-separator h-px flex-1" />
            </div>
            <FilePicker
              title="Select directory for new collection"
              description="This is where the imported collection will be placed"
              entry={targetEntry}
              icon={<FolderPlusIcon size={36} />}
              onFileSelected={setTargetEntry}
              onFileRemoved={() => setTargetEntry(undefined)}
              directoryMode
              controlled
            />
            <TitleInput value={title} onChange={setTitle} />
          </ImportTabsContent>

          <ImportTabsContent strategy="Bruno" gap={false}>
            <span>Coming soon...</span>
          </ImportTabsContent>

          <ImportTabsContent strategy="Insomnia" gap={false}>
            <span>Coming soon...</span>
          </ImportTabsContent>
        </Tabs>

        {dialogFooter}
      </DialogContent>
    </Dialog>
  );
};

export default CollectionImport;
