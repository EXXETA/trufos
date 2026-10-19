import { TabbedDialog } from '@/components/shared/TabbedDialog';
import { AuthorizationEditor } from '@/components/shared/settings/AuthorizationTab/AuthorizationEditor';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { selectFolder, useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { deepEqual } from '@/util/object-util';
import { FolderInfo } from 'shim/collection-model';
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
  const [auth, setAuth] = useState<AuthorizationInformationNoInherit | null>(storedAuth);
  const isChanged = !deepEqual(auth, storedAuth);

  const save = async () => {
    // the dialog stays open if saving failed
    if (isChanged && !(await updateFolder(folder.id, { auth }))) return;
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
