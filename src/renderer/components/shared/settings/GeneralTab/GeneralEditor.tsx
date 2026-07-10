import { ChangeEvent, useCallback, useEffect, useState } from 'react';
import { CollectionBase } from 'shim/objects/collection';
import { useCollectionActions, useCollectionStore } from '@/state/appStore';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { MdOutlineContentCopy } from 'react-icons/md';
import { TypographyLineClamp } from '@/components/shared/TypographyLineClamp';
import { RendererEventService } from '@/services/event/renderer-event-service';

const eventService = RendererEventService.instance;

export interface GeneralEditorProps {
  /** The current value of the collection name input. */
  name: string;
  /** Called when the user edits the collection name. */
  onNameChange: (name: string) => void;
  /** Called after the collection has been closed so the parent can dismiss the modal. */
  onCloseCollection: () => void;
}

export const GeneralEditor = ({ name, onNameChange, onCloseCollection }: GeneralEditorProps) => {
  const { closeCollection } = useCollectionActions();
  const collection = useCollectionStore((s) => s.collection);
  const [collections, setCollections] = useState<CollectionBase[]>([]);

  const loadCollections = useCallback(async () => {
    setCollections(await eventService.listCollections());
  }, []);

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  const handleChangeName = (event: ChangeEvent<HTMLInputElement>) => {
    onNameChange(event.target.value);
  };

  const handleCloseCollection = () => {
    closeCollection();
    onCloseCollection();
  };

  const handleCopyPath = async () => {
    if (collection?.dirPath) {
      await navigator.clipboard.writeText(collection.dirPath);
    }
  };

  return (
    <div className="space-y-4">
      {collection?.type === 'collection' && collection.dirPath && (
        <div className="bg-muted/40 text-muted-foreground grid grid-cols-[1fr_auto] items-center gap-2 rounded-md p-2 text-sm">
          <TypographyLineClamp contentClassname={'text-xs text-text-secondary'} lineClamp={2}>
            {collection.dirPath}
          </TypographyLineClamp>

          <Button variant="secondary" size="icon" onClick={handleCopyPath} title="Copy path">
            <MdOutlineContentCopy size={16} />
          </Button>
        </div>
      )}

      <Input value={name} type="text" onChange={handleChangeName} />

      {!collection?.isDefault && (
        <>
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
        </>
      )}
    </div>
  );
};
