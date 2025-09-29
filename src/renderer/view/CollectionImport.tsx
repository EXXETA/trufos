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
import { FolderIcon } from '@/components/icons';
import { ImportStrategy } from 'shim/event-service';
import { showError } from '@/error/errorHandler';

const eventService = RendererEventService.instance;

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
      />
    </div>
  );
};

const ImportTabsContent: React.FC<{
  children: React.ReactNode;
  strategy: ImportStrategy | 'Trufos';
  /** Whether to include default vertical spacing (gap) */
  gap?: boolean;
}> = ({ children, strategy, gap = true }) => {
  return (
    <TabsContent value={strategy} className="overflow-hidden rounded-none bg-transparent">
      <div
        className={cn('flex max-h-[calc(80vh-170px)] flex-col overflow-y-auto pr-2', {
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

  const [strategy, setStrategy] = useState<ImportStrategy>('Postman');
  const [srcEntry, setSrcEntry, resetSrcEntry] = useStateResettable<DroppedEntryInfo>();
  const [targetEntry, setTargetEntry, resetTargetEntry] = useStateResettable<DroppedEntryInfo>();
  const [title, setTitle, resetTitle] = useStateResettable('');
  const [isImporting, setIsImporting, resetIsImporting] = useStateResettable(false);

  const canImport = srcEntry && targetEntry && !isImporting;

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
      await changeCollection(
        await eventService.importCollection(srcEntry.path, targetEntry.path, strategy, title)
      );
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
          <Button onClick={doImport} disabled={!canImport} className="gap-2">
            <Plus size={16} /> {isImporting ? 'Importing...' : 'Complete Import'}
          </Button>
        </div>
      </DialogFooter>
    );
  }, [strategy, doImport, canImport, isImporting]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="flex max-h-[80vh] w-[760px] max-w-3xl flex-col border-none shadow-none">
        <DialogHeader>
          <DialogTitle>Import Collection</DialogTitle>
        </DialogHeader>

        <Tabs
          value={strategy}
          onValueChange={(v) => setStrategy(v as ImportStrategy)}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <TabsList className="mb-2">
            <TabsTrigger value="Trufos">Trufos</TabsTrigger>
            <TabsTrigger value="Postman">Postman</TabsTrigger>
            <TabsTrigger value="Bruno">Bruno</TabsTrigger>
            <TabsTrigger value="Insomnia">Insomnia</TabsTrigger>
          </TabsList>

          <ImportTabsContent strategy="Trufos">
            <FilePicker
              title="Select directory of the existing collection"
              description="Select the folder containing the collection.json file"
              icon={<FolderIcon size={36} />}
              entry={targetEntry}
              onFileSelected={setTargetEntry}
              onFileRemoved={() => setTargetEntry(undefined)}
              directoryMode
              controlled
            />
          </ImportTabsContent>

          <ImportTabsContent strategy="Postman">
            <FilePicker
              title="Select file of the original collection"
              description="Postman exports .json files"
              entry={srcEntry}
              onFileSelected={setSrcEntry}
              onFileRemoved={() => setSrcEntry(undefined)}
              accept=".json"
              controlled
            />
            <FilePicker
              title="Select directory for new collection"
              description="This is where the imported collection will be placed"
              icon={<FolderIcon size={36} />}
              entry={targetEntry}
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
