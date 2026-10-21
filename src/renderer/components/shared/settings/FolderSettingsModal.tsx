import { TabbedDialog } from '@/components/shared/TabbedDialog';
import { AuthorizationEditor } from '@/components/shared/settings/AuthorizationTab/AuthorizationEditor';
import { HeaderEditor } from '@/components/shared/headers/HeaderEditor';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import {
  selectFolder,
  useCollectionActions,
  useCollectionStore,
  useInheritedHeaders,
} from '@/state/collectionStore';
import { deepEqual } from '@/util/object-util';
import { emptyToNull, FolderChanges, FolderInfo } from 'shim/collection-model';
import { TrufosHeader } from 'shim/objects/headers';
import { TrufosId } from 'shim/objects/id';
import {
  AuthorizationInformationNoInherit,
  AuthorizationType,
  withoutInherit,
} from 'shim/objects/auth';

export interface FolderSettingsModalProps {
  /** The folder to edit. The modal is closed if there is none. */
  folderId?: TrufosId;
  onClose: () => void;
}

/** Edits the settings of a folder. A new working copy is taken for every folder that is opened. */
export const FolderSettingsModal = ({ folderId, onClose }: FolderSettingsModalProps) => {
  const folder = useCollectionStore((s) =>
    folderId == null ? undefined : selectFolder(s, folderId)
  );
  return folder == null ? null : (
    <FolderSettingsDialog key={folder.id} folder={folder} onClose={onClose} />
  );
};

interface FolderSettingsDialogProps {
  folder: FolderInfo;
  onClose: () => void;
}

/** Edits a working copy of the folder settings and commits it on save. */
const FolderSettingsDialog = ({ folder, onClose }: FolderSettingsDialogProps) => {
  const { updateFolder } = useCollectionActions();
  const storedAuth = folder.auth ?? null;
  const storedHeaders = folder.headers ?? [];
  const [auth, setAuth] = useState<AuthorizationInformationNoInherit | null>(storedAuth);
  const [headers, setHeaders] = useState<TrufosHeader[]>(storedHeaders);
  const inherited = useInheritedHeaders({ parentId: folder.parentId, headers });

  const changes: FolderChanges = {};
  if (!deepEqual(auth, storedAuth)) changes.auth = auth;
  if (!deepEqual(headers, storedHeaders)) changes.headers = emptyToNull(headers);
  const isChanged = Object.keys(changes).length > 0;

  const save = async () => {
    // the dialog stays open if saving failed
    if (isChanged && !(await updateFolder(folder.id, changes))) return;
    onClose();
  };

  return (
    <TabbedDialog
      title={`Folder Settings - ${folder.title}`}
      isOpen
      onClose={onClose}
      tabs={[
        {
          value: 'authorization',
          label: 'Authorization',
          content: (
            <div className="h-full overflow-y-auto p-4">
              <AuthorizationEditor
                level="folder"
                parentId={folder.parentId}
                // a folder without an authorization inherits it
                auth={auth ?? { type: AuthorizationType.INHERIT }}
                onAuthChange={(changed) => setAuth(withoutInherit(changed))}
              />
            </div>
          ),
        },
        {
          value: 'headers',
          label: 'Headers',
          content: (
            <div className="h-full overflow-y-auto p-4">
              <HeaderEditor headers={headers} onChange={setHeaders} derived={{ inherited }} />
            </div>
          ),
        },
      ]}
      footer={
        <>
          <Button onClick={onClose} variant="outline">
            <span className="leading-4 font-bold">Cancel</span>
          </Button>
          <Button onClick={save} disabled={!isChanged} className="h-10 px-5">
            <span className="leading-4 font-bold">Save</span>
          </Button>
        </>
      }
    />
  );
};
