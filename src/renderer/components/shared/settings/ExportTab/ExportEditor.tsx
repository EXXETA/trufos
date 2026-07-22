import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { SecretInput } from '@/components/ui/secret-input';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { useCollectionStore } from '@/state/collectionStore';
import { showError } from '@/error/errorHandler';
import { toast } from '@/components/ui/sonner';
import { sanitizeTitle } from 'shim/fs';

const eventService = RendererEventService.instance;

/**
 * Lets the user export the current collection as a `.zip` archive. Secrets, drafts, request
 * history, and `.gitignore`d files are excluded by default. Optionally the user can include their
 * (decrypted) secrets and/or protect the archive with an AES-256 password. Only the persisted
 * collection state is exported, so unsaved changes in this dialog are not included unless saved.
 */
export const ExportEditor = () => {
  const dirPath = useCollectionStore((s) => s.collection?.dirPath);
  const title = useCollectionStore((s) => s.collection?.title ?? 'collection');

  const [includeSecrets, setIncludeSecrets] = useState(false);
  const [password, setPassword] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (dirPath == null || isExporting) return;
    try {
      const { canceled, filePath } = await eventService.showSaveDialog({
        defaultPath: `${sanitizeTitle(title) || 'collection'}.zip`,
        filters: [{ name: 'Zip Archive', extensions: ['zip'] }],
      });
      if (canceled || filePath == null) return;

      setIsExporting(true);
      await eventService.exportCollection(dirPath, filePath, 'Zip', {
        includeSecrets,
        password: password.length > 0 ? password : undefined,
      });
      toast.success('Collection exported', { description: filePath });
    } catch (error) {
      showError('Failed to export collection', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <div>
        <h3 className="text-sidebar-foreground font-medium">Export as ZIP</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Package this collection as a <code>.zip</code> archive for sharing or backup. Unsaved
          drafts, request history, and <code>.gitignore</code>d files are excluded. Only the saved
          collection state is exported &mdash; save any pending changes first.
        </p>
      </div>

      <div className="flex items-start space-x-2">
        <Checkbox
          id="export-include-secrets"
          checked={includeSecrets}
          onCheckedChange={(checked) => setIncludeSecrets(checked === true)}
          className="mt-0.5"
        />
        <label htmlFor="export-include-secrets" className="cursor-pointer text-sm">
          <span className="text-text-primary font-medium">Include secrets</span>
          <span className="text-muted-foreground block">
            Secret variables and auth are decrypted and written into the archive as plaintext. Set a
            password below to keep them protected.
          </span>
        </label>
      </div>

      <div className="space-y-1">
        <label htmlFor="export-password" className="text-sm font-medium">
          Password (optional)
        </label>
        <SecretInput
          id="export-password"
          secret
          value={password}
          placeholder="Encrypt the archive with AES-256"
          onChange={(e) => setPassword(e.target.value)}
        />
        {includeSecrets && password.length === 0 && (
          <p className="text-muted-foreground text-xs">
            Warning: without a password, your secrets are stored unencrypted in the archive.
          </p>
        )}
      </div>

      <Button className="w-fit" onClick={handleExport} disabled={dirPath == null || isExporting}>
        {isExporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        <span className="leading-4 font-bold">{isExporting ? 'Exporting…' : 'Export as ZIP…'}</span>
      </Button>
    </div>
  );
};
