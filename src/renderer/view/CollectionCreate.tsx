import React, { useState } from 'react';
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
// eslint-disable-next-line import/no-named-as-default
import FilePicker from '@/components/ui/file-picker';
import { DroppedEntryInfo } from '@/components/ui/file-drop-zone';
import { FolderPlusIcon } from '@/components/icons';

const eventService = RendererEventService.instance;

interface TitleInputProps {
  value: string;
  onChange: (value: string) => void;
}

const TitleInput: React.FC<TitleInputProps> = ({ value, onChange }) => {
  return (
    <div className="flex flex-col gap-2">
      <Input
        className="rounded-lg"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="My new Collection"
      />
    </div>
  );
};

export const CollectionCreate: React.FC<{
  onClose?: () => void;
  open?: boolean;
  loadCollections: () => void;
}> = ({ onClose, open = true, loadCollections }) => {
  const { changeCollection } = useCollectionActions();

  const [targetEntry, setTargetEntry] = useState<DroppedEntryInfo>();
  const [title, setTitle] = useState<string>('');

  const isCreationDisabled = !title && !targetEntry?.name;

  const createCollection = async () => {
    try {
      await changeCollection(await eventService.createCollection(targetEntry.path, title));

      console.info('Creating collection at', targetEntry.path);

      await loadCollections();
    } catch (e) {
      console.error('Error creating collection:', e);
    } finally {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="flex max-h-[80vh] w-[760px] max-w-3xl flex-col border-none shadow-none">
        <DialogHeader>
          <DialogTitle>New Collection</DialogTitle>
        </DialogHeader>

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

        <DialogFooter className="mt-2 justify-center gap-2 sm:justify-center">
          <div className="flex w-full justify-center">
            <Button
              onClick={createCollection}
              disabled={isCreationDisabled}
              className="pointer gap-2"
            >
              <Plus size={16} /> {'Create Collection'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
