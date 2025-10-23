import { useMemo, useState, useEffect, ChangeEvent } from 'react';
import { Collection } from 'shim/objects/collection';
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
import { MdOutlineContentCopy, MdOutlineModeEdit } from 'react-icons/md';
import { TypographyLineClamp } from '@/components/shared/TypographyLineClamp';
import { cn } from '@/lib/utils';

export interface CollectionSettingsProps {
  trufosObject: Collection;
  isOpen: boolean;
  onClose: () => void;
}

export const CollectionSettings = ({ trufosObject, isOpen, onClose }: CollectionSettingsProps) => {
  const [name, setName] = useState('');
  const [pathName, setPathName] = useState('');

  const { renameCollection, closeCollection } = useCollectionActions();

  useEffect(() => {
    setName(trufosObject.title);
  }, [trufosObject.title]);

  useEffect(() => {
    setPathName(trufosObject?.dirPath);
  }, [trufosObject?.dirPath]);

  const handleChangeName = (event: ChangeEvent<HTMLInputElement>) => {
    setName(event.target.value);
  };

  const handleRenameCollection = () => {
    renameCollection(name);

    onClose();
  };

  const handleCloseCollection = () => {
    closeCollection();

    onClose();
  };

  const handleCopyPath = async () => {
    await navigator.clipboard.writeText(trufosObject.dirPath);
  };

  const isValid = useMemo(() => {
    return name.trim().length > 0 && name !== trufosObject.title;
  }, [name, trufosObject.title]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Collection Settings</DialogTitle>
          <DialogDescription className={'text-[var(--text-secondary)]'}>
            Manage your collection options below.
          </DialogDescription>
        </DialogHeader>

        {trufosObject.type === 'collection' && trufosObject.dirPath && (
          <div className="bg-muted/40 text-muted-foreground grid grid-cols-[1fr_auto] items-center gap-2 rounded-md p-2 text-sm">
            <TypographyLineClamp
              contentClassname={'text-xs text-[var(--text-secondary)]'}
              lineClamp={2}
            >
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
              className={cn('flex gap-1 p-4', { 'border-0 text-[var(--disabled)]': !isValid })}
              variant="secondary"
              disabled={!isValid}
              onClick={handleRenameCollection}
            >
              <span className="flex">Rename</span>

              <MdOutlineModeEdit size={16} />
            </Button>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <span className="text-destructive font-medium">Close Collection</span>
            <Button
              variant="destructive"
              size="sm"
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
