import React, { useCallback, useEffect } from 'react';
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

type ImportStrategy = 'Postman' | 'Bruno' | 'Insomnia';

const eventService = RendererEventService.instance;

export const CollectionImport: React.FC<{ onClose?: () => void; open?: boolean }> = ({
  onClose,
  open = true,
}) => {
  const { changeCollection } = useCollectionActions();
  // Resettable states
  const [strategy, setStrategy, resetStrategy] = useStateResettable<ImportStrategy>('Postman');
  const [srcEntry, setSrcEntry, resetSrcEntry] = useStateResettable<DroppedEntryInfo>();
  const [targetEntry, setTargetEntry, resetTargetEntry] = useStateResettable<DroppedEntryInfo>();
  const [title, setTitle, resetTitle] = useStateResettable('');
  const [isImporting, setIsImporting, resetIsImporting] = useStateResettable(false);
  const [error, setError, resetError] = useStateResettable<string>();

  const canImport = srcEntry && targetEntry && !isImporting;

  useEffect(() => {
    if (open) {
      resetStrategy();
      resetSrcEntry();
      resetTargetEntry();
      resetTitle();
      resetError();
      resetIsImporting();
    }
  }, [open]);

  const doImport = useCallback(async () => {
    try {
      setIsImporting(true);
      setError(null);
      await changeCollection(
        await eventService.importCollection(srcEntry.path, targetEntry.path, strategy, title)
      );
      onClose?.();
    } catch (e) {
      console.error(e);
      setError((e as Error).message);
    } finally {
      setIsImporting(false);
    }
  }, [srcEntry, targetEntry, strategy, title, onClose, changeCollection]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Import Collection</DialogTitle>
        </DialogHeader>
        <Tabs value={strategy} onValueChange={(v) => setStrategy(v as ImportStrategy)}>
          <TabsList className="mb-4 grid grid-cols-4">
            <TabsTrigger value="Trufos" disabled>
              Trufos
            </TabsTrigger>
            <TabsTrigger value="Postman">Postman</TabsTrigger>
            <TabsTrigger value="Bruno" disabled>
              Bruno
            </TabsTrigger>
            <TabsTrigger value="Insomnia" disabled>
              Insomnia
            </TabsTrigger>
          </TabsList>
          <TabsContent
            value={strategy}
            className="m-0 flex flex-col gap-6 rounded-none bg-transparent p-0"
          >
            <FilePicker
              title="Select file of the original collection"
              description="Postman, Bruno and Insomnia collections are supported"
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
            <div className="flex flex-col gap-2">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Name of the new collection"
              />
            </div>
            {error && (
              <div className="text-sm text-destructive" role="alert">
                {error}
              </div>
            )}
            <DialogFooter className="mt-2 gap-2">
              <Button onClick={doImport} disabled={!canImport} className="gap-2 self-center">
                <Plus size={16} /> {isImporting ? 'Importing...' : 'Complete Import'}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default CollectionImport;
