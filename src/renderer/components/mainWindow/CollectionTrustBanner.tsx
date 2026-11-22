import { type JSX, useEffect, useState } from 'react';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { showError } from '@/error/errorHandler';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import { useCollectionStore } from '@/state/collectionStore';

const eventService = RendererEventService.instance;

/** Whether the user trusts a collection, see {@link CollectionTrustBanner}. */
interface Trust {
  dirPath: string;
  trusted: boolean;
}

/**
 * Tells the user that the open collection is in restricted mode, as they do not trust it yet, and
 * lets them trust it. A collection the user did not create in the app, e.g. one cloned from a
 * repository, may come from anyone: until it is trusted, its scripts do not run and its requests
 * only send files inside of it. Shows nothing for a trusted collection.
 */
export const CollectionTrustBanner = (): JSX.Element | null => {
  const dirPath = useCollectionStore((state) => state.collection.dirPath);
  const [trust, setTrust] = useState<Trust>();

  useEffect(() => {
    let current = true;
    eventService.isCollectionTrusted(dirPath).then(
      (trusted) => current && setTrust({ dirPath, trusted }),
      (error) => showError('Could not check whether you trust the collection', error)
    );
    return () => {
      current = false;
    };
  }, [dirPath]);

  // the answer for another collection must not show up while the new one is checked
  if (trust?.dirPath !== dirPath || trust.trusted) return null;

  const trustCollection = () =>
    eventService
      .trustCollection(dirPath)
      .then(() => {
        setTrust({ dirPath, trusted: true });
        toast.success('Collection trusted', { description: 'Its scripts run from now on.' });
      })
      .catch((error) => showError('Could not trust the collection', error));

  return (
    <Alert role="note" className="rounded-none">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="flex-1">
          <strong>Restricted mode:</strong> scripts of this collection do not run, and its requests
          only send files inside of it. Scripts can access all files on this computer, so only trust
          collections from sources you trust.
        </span>
        <Button variant="secondary" size="sm" onClick={() => void trustCollection()}>
          Trust collection
        </Button>
      </div>
    </Alert>
  );
};
