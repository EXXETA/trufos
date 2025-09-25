import React, { useCallback, useEffect } from 'react';
import { useStateResettable } from '@/util/react-util';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { useCollectionActions } from '@/state/collectionStore';
import { FolderOpen, Upload } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

type ImportStrategy = 'Postman' | 'Bruno' | 'Insomnia';

const eventService = RendererEventService.instance;

interface PathSelectorProps {
  label: string;
  placeholder: string;
  path?: string;
  onPick: (path: string) => void;
  type: 'file' | 'directory';
  acceptExtensions?: string[]; // only for file
}

const PathSelector: React.FC<PathSelectorProps> = ({
  label,
  placeholder,
  path,
  onPick,
  type,
  acceptExtensions,
}) => {
  const pick = useCallback(async () => {
    const properties: Electron.OpenDialogOptions['properties'] =
      type === 'file' ? ['openFile'] : ['openDirectory'];
    const filters =
      type === 'file' && acceptExtensions
        ? [
            {
              name: 'Supported Files',
              extensions: acceptExtensions.map((e) => e.replace(/^\./, '')),
            },
          ]
        : undefined;
    const result = await eventService.showOpenDialog({ properties, filters });
    if (!result.canceled && result.filePaths.length > 0) {
      onPick(result.filePaths[0]);
    }
  }, [onPick, type, acceptExtensions]);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <div className="flex h-20 flex-1 items-center justify-center truncate rounded-md border border-dashed border-border bg-background/40 px-3 py-2 text-center text-sm">
          {path ? (
            <span className="truncate" title={path}>
              {path}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </div>
      </div>
      <div className="flex justify-center">
        <Button variant="ghost" size="sm" onClick={pick} className="gap-2">
          <FolderOpen size={16} /> Select {type === 'file' ? 'File' : 'Directory'}
        </Button>
      </div>
    </div>
  );
};

export const CollectionImport: React.FC<{ onClose?: () => void; open?: boolean }> = ({
  onClose,
  open = true,
}) => {
  const { changeCollection } = useCollectionActions();
  // Resettable states
  const [strategy, setStrategy, resetStrategy] = useStateResettable<ImportStrategy>('Postman');
  const [srcFilePath, setSrcFilePath, resetSrcFilePath] = useStateResettable<string | undefined>(
    undefined
  );
  const [targetDirPath, setTargetDirPath, resetTargetDirPath] = useStateResettable<
    string | undefined
  >(undefined);
  const [title, setTitle, resetTitle] = useStateResettable('');
  const [isImporting, setIsImporting, resetIsImporting] = useStateResettable(false);
  const [error, setError, resetError] = useStateResettable<string | null>(null);

  const canImport = srcFilePath && targetDirPath && !isImporting;

  useEffect(() => {
    if (open) {
      resetStrategy();
      resetSrcFilePath();
      resetTargetDirPath();
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
        await eventService.importCollection(srcFilePath, targetDirPath, strategy, title)
      );
      onClose?.();
    } catch (e) {
      console.error(e);
      setError((e as Error).message);
    } finally {
      setIsImporting(false);
    }
  }, [srcFilePath, targetDirPath, strategy, title, onClose, changeCollection]);

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
          <TabsContent value={strategy} className="m-0 flex flex-col gap-6 bg-transparent p-0">
            <PathSelector
              label="Source File"
              placeholder="Select directory of the original collection"
              path={srcFilePath}
              onPick={setSrcFilePath}
              type="file"
              acceptExtensions={['.json']}
            />
            <PathSelector
              label="Target Directory"
              placeholder="Select directory for new collection"
              path={targetDirPath}
              onPick={setTargetDirPath}
              type="directory"
            />
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Name of the new collection
              </span>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="My Imported Collection"
              />
            </div>
            {error && (
              <div className="text-sm text-destructive" role="alert">
                {error}
              </div>
            )}
            <DialogFooter className="mt-2 gap-2">
              <Button onClick={doImport} disabled={!canImport} className="gap-2 self-center">
                <Upload size={16} /> {isImporting ? 'Importing...' : 'Complete Import'}
              </Button>
              <Button variant="ghost" type="button" onClick={onClose}>
                Cancel
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default CollectionImport;
