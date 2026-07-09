import { Button } from '@/components/ui/button';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { useCollectionStore } from '@/state/collectionStore';
import { showError } from '@/error/errorHandler';
import { toast } from '@/components/ui/sonner';
import { sanitizeTitle } from 'shim/fs';

const eventService = RendererEventService.instance;

/**
 * Lets the user export the current collection as a `.zip` archive. Secrets, drafts, request
 * history, and `.gitignore`d files are excluded. Only the persisted collection state is exported,
 * so unsaved changes in this dialog are not included unless they are saved first.
 */
export const ExportEditor = () => {
  const dirPath = useCollectionStore((s) => s.collection?.dirPath);
  const title = useCollectionStore((s) => s.collection?.title ?? 'collection');

  const handleExport = async () => {
    if (dirPath == null) return;
    try {
      const { canceled, filePath } = await eventService.showSaveDialog({
        defaultPath: `${sanitizeTitle(title) || 'collection'}.zip`,
        filters: [{ name: 'Zip Archive', extensions: ['zip'] }],
      });
      if (canceled || filePath == null) return;

      await eventService.exportCollection(dirPath, filePath, 'Zip');
      toast.success('Collection exported', { description: filePath });
    } catch (error) {
      showError('Failed to export collection', error);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div>
        <h3 className="text-sidebar-foreground font-medium">Export as ZIP</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Package this collection as a <code>.zip</code> archive for sharing or backup. Secrets,
          unsaved drafts, request history, and <code>.gitignore</code>d files are excluded. Only the
          saved collection state is exported &mdash; save any pending changes first.
        </p>
      </div>
      <Button className="w-fit" onClick={handleExport} disabled={dirPath == null}>
        <span className="leading-4 font-bold">Export as ZIP…</span>
      </Button>
    </div>
  );
};
