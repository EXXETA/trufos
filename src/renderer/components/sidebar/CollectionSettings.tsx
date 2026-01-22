import { useMemo, useState, useEffect, useCallback, ChangeEvent } from 'react';
import { Collection, CollectionBase } from 'shim/objects/collection';
import { useCollectionActions } from '@/state/collectionStore';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { MdOutlineContentCopy, MdOutlineModeEdit } from 'react-icons/md';
import { TypographyLineClamp } from '@/components/shared/TypographyLineClamp';
import { cn } from '@/lib/utils';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { Download } from 'lucide-react';

const eventService = RendererEventService.instance;

export interface CollectionSettingsProps {
  trufosObject: Collection;
  isOpen: boolean;
  onClose: () => void;
}

export const CollectionSettings = ({ trufosObject, isOpen, onClose }: CollectionSettingsProps) => {
  const [name, setName] = useState('');
  const [pathName, setPathName] = useState('');
  const [collections, setCollections] = useState<CollectionBase[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [includeSecrets, setIncludeSecrets] = useState(false);

  const loadCollections = useCallback(async () => {
    setCollections(await eventService.listCollections());
  }, [setCollections]);

  useEffect(() => {
    loadCollections();
  }, [isOpen]);

  const { renameCollection, closeCollection } = useCollectionActions();

  useEffect(() => {
    setName(trufosObject.title);
  }, [isOpen]);

  useEffect(() => {
    setPathName(trufosObject?.dirPath);
  }, [isOpen]);

  const handleChangeName = (event: ChangeEvent<HTMLInputElement>) => {
    setName(event.target.value);
  };

  const handleRenameCollection = async () => {
    try {
      await renameCollection(name);

      onClose();
    } catch (err) {
      console.error('Failed to rename collection', err);
    }
  };

  const handleCloseCollection = () => {
    closeCollection();

    onClose();
  };

  const handleCopyPath = async () => {
    await navigator.clipboard.writeText(trufosObject.dirPath);
  };

  const handleExportCollection = async () => {
    try {
      setIsExporting(true);
      const result = await eventService.showOpenDialog({
        title: 'Select Export Location',
        buttonLabel: 'Export',
        properties: ['openDirectory'],
      });

      if (!result.canceled && result.filePaths.length > 0) {
        const outputPath = result.filePaths[0];
        await eventService.exportCollection(trufosObject, outputPath, includeSecrets);
        console.info('Collection exported successfully');
      }
    } catch (err) {
      console.error('Failed to export collection', err);
    } finally {
      setIsExporting(false);
    }
  };

  const isValid = useMemo(() => {
    return name.trim().length > 0 && name !== trufosObject.title;
  }, [name, trufosObject.title]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Collection Settings</DialogTitle>
          <DialogDescription className={'text-text-secondary'}>
            Manage your collection options below.
          </DialogDescription>
        </DialogHeader>

        {trufosObject.type === 'collection' && trufosObject.dirPath && (
          <div className="bg-muted/40 text-muted-foreground grid grid-cols-[1fr_auto] items-center gap-2 rounded-md p-2 text-sm">
            <TypographyLineClamp contentClassname={'text-xs text-text-secondary'} lineClamp={2}>
              {pathName}
            </TypographyLineClamp>

            <Button variant="secondary" size="icon" onClick={handleCopyPath} title="Copy path">
              <MdOutlineContentCopy size={16} />
            </Button>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-center gap-6">
            <Input value={name} type="text" onChange={handleChangeName} />
            <Button
              className={cn('flex gap-1 p-4')}
              variant={!isValid ? 'disabled' : 'secondary'}
              disabled={!isValid}
              onClick={handleRenameCollection}
            >
              <span className="flex">Rename</span>

              <MdOutlineModeEdit size={16} />
            </Button>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-text-secondary font-medium">Export Collection</span>

              <Button
                variant={'secondary'}
                size="sm"
                disabled={isExporting}
                className="flex gap-2 rounded-full"
                onClick={handleExportCollection}
              >
                <Download size={16} />
                {isExporting ? 'Exporting...' : 'Export'}
              </Button>
            </div>

            <div className="flex items-center gap-2 pl-4">
              <Checkbox
                id="include-secrets"
                checked={includeSecrets}
                onCheckedChange={(checked) => setIncludeSecrets(checked === true)}
              />
              <label
                htmlFor="include-secrets"
                className="text-text-secondary cursor-pointer text-sm"
              >
                Include secret values
              </label>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <span className="text-destructive font-medium">Close Collection</span>

            <Button
              variant={'destructive'}
              size="sm"
              disabled={collections.length === 1}
              className="rounded-full"
              onClick={handleCloseCollection}
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
