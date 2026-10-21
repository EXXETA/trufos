import { TabbedDialog } from '@/components/shared/TabbedDialog';
import { GeneralEditor } from '@/components/shared/settings/GeneralTab/GeneralEditor';
import {
  VariableEditor,
  getInvalidVariableKeys,
} from '@/components/shared/settings/VariableTab/VariableEditor';
import { EnvironmentEditor } from '@/components/shared/settings/EnvironmentTab/EnvironmentEditor';
import { CertificateEditor } from '@/components/shared/settings/TlsTab/CertificateEditor';
import { ExportEditor } from '@/components/shared/settings/ExportTab/ExportEditor';
import { AuthorizationEditor } from '@/components/shared/settings/AuthorizationTab/AuthorizationEditor';
import { HeaderEditor } from '@/components/shared/headers/HeaderEditor';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { variableArrayToMap, variableMapToArray } from '@/state/helper/variableMappers';
import { useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { deepEqual } from '@/util/object-util';
import { ClientCertificate } from 'shim/objects/collection';
import { VariableObjectWithKey } from 'shim/objects/variables';
import { EnvironmentMap } from 'shim/objects/environment';
import { CollectionChanges, emptyToNull } from 'shim/collection-model';
import { AuthorizationInformationNoInherit, withoutInherit } from 'shim/objects/auth';
import { TrufosHeader } from 'shim/objects/headers';

export interface CollectionSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * A single working copy of the editable collection state. The modal edits one composed draft and
 * commits it back on save. Variables are kept in array form so in-progress/empty/duplicate keys are preserved
 * while editing; they are converted to a map only at commit time.
 */
type CollectionDraft = {
  title: string;
  variables: VariableObjectWithKey[];
  environments: EnvironmentMap;
  selectedEnvironment?: string;
  clientCertificate: ClientCertificate | null;
  auth: AuthorizationInformationNoInherit | null;
  headers: TrufosHeader[];
};

export const CollectionSettingsModal = ({ isOpen, onClose }: CollectionSettingsModalProps) => {
  const { updateCollection } = useCollectionActions();

  const variables = useCollectionStore((s) => s.collection.variables);
  const environments = useCollectionStore((s) => s.collection.environments);
  const selectedEnvironment = useCollectionStore((s) => s.selectedEnvironmentKey);
  const storedCertificate = useCollectionStore((s) => s.collection.clientCertificate ?? null);
  const collectionTitle = useCollectionStore((s) => s.collection.title);
  const storedAuth = useCollectionStore((s) => s.collection.auth ?? null);
  const storedHeaders = useCollectionStore((s) => s.collection.headers);

  const buildDraft = (): CollectionDraft => ({
    title: collectionTitle,
    variables: variableMapToArray(variables),
    environments,
    selectedEnvironment,
    clientCertificate: storedCertificate,
    auth: storedAuth,
    headers: storedHeaders ?? [],
  });

  const [draft, setDraft] = useState<CollectionDraft>(buildDraft);
  const [initialDraft, setInitialDraft] = useState<CollectionDraft | null>(null);

  const update = (partial: Partial<CollectionDraft>) => setDraft((d) => ({ ...d, ...partial }));

  const isGeneralValid = draft.title.trim().length > 0;
  const isVariablesValid = getInvalidVariableKeys(draft.variables).size === 0;
  const selectedEnvironment_ =
    draft.selectedEnvironment != null ? draft.environments[draft.selectedEnvironment] : undefined;
  const isEnvironmentValid =
    selectedEnvironment_ == null
      ? true
      : getInvalidVariableKeys(variableMapToArray(selectedEnvironment_.variables)).size === 0;
  const isOverallValid = isGeneralValid && isVariablesValid && isEnvironmentValid;

  const somethingChanged = initialDraft !== null && !deepEqual(draft, initialDraft);
  const canSave = isOverallValid && somethingChanged;

  // the working copy is taken when the dialog opens, so changes made elsewhere meanwhile don't
  // discard the unsaved input. Saving overwrites them.
  useEffect(() => {
    if (isOpen) {
      const initial = buildDraft();
      setDraft(initial);
      setInitialDraft(initial);
    }
  }, [isOpen]);

  const save = async () => {
    const isChanged = (key: keyof CollectionDraft) => !deepEqual(draft[key], initialDraft?.[key]);
    const changes: CollectionChanges = {};
    if (isChanged('title')) changes.title = draft.title.trim();
    if (isChanged('variables')) changes.variables = variableArrayToMap(draft.variables);
    if (isChanged('environments')) changes.environments = draft.environments;
    if (isChanged('clientCertificate')) changes.clientCertificate = draft.clientCertificate;
    if (isChanged('auth')) changes.auth = draft.auth;
    if (isChanged('headers')) changes.headers = emptyToNull(draft.headers);

    const selectedEnvironmentKey = isChanged('selectedEnvironment')
      ? (draft.selectedEnvironment ?? null)
      : undefined;

    // the dialog stays open if saving failed
    const isUnchanged = Object.keys(changes).length === 0 && selectedEnvironmentKey === undefined;
    if (!isUnchanged && !(await updateCollection(changes, selectedEnvironmentKey))) return;
    onClose();
  };

  return (
    <TabbedDialog
      title="Collection Settings"
      isOpen={isOpen}
      onClose={onClose}
      tabs={[
        {
          value: 'general',
          label: 'General',
          content: (
            <div className="h-full overflow-y-auto p-4">
              <GeneralEditor
                name={draft.title}
                onNameChange={(title) => update({ title })}
                onCloseCollection={onClose}
              />
            </div>
          ),
        },
        {
          value: 'variables',
          label: 'Variables',
          content: (
            <div className="h-full overflow-y-auto p-4">
              <VariableEditor
                variables={draft.variables}
                onVariablesChange={(variables) => update({ variables })}
              />
            </div>
          ),
        },
        {
          value: 'environments',
          label: 'Environments',
          content: (
            <EnvironmentEditor
              environments={draft.environments}
              selectedEnvironment={draft.selectedEnvironment ?? null}
              onEnvironmentsChange={(environments) => update({ environments })}
              onEnvironmentSelect={(key) => update({ selectedEnvironment: key ?? undefined })}
            />
          ),
        },
        {
          value: 'authorization',
          label: 'Authorization',
          content: (
            <div className="h-full overflow-y-auto p-4">
              <AuthorizationEditor
                level="collection"
                auth={draft.auth ?? undefined}
                onAuthChange={(auth) => update({ auth: withoutInherit(auth) })}
              />
            </div>
          ),
        },
        {
          value: 'headers',
          label: 'Headers',
          content: (
            <div className="h-full overflow-y-auto p-4">
              <HeaderEditor
                headers={draft.headers}
                onChange={(change) => setDraft((d) => ({ ...d, headers: change(d.headers) }))}
              />
            </div>
          ),
        },
        {
          value: 'tls',
          label: 'mTLS',
          content: (
            <CertificateEditor
              certificate={draft.clientCertificate}
              onCertificateChange={(clientCertificate) => update({ clientCertificate })}
            />
          ),
        },
        { value: 'export', label: 'Export', content: <ExportEditor /> },
      ]}
      footer={
        <>
          <Button onClick={onClose} variant="outline">
            <span className="leading-4 font-bold">Cancel</span>
          </Button>
          <Button onClick={save} disabled={!canSave} className="h-10 px-5">
            <span className="leading-4 font-bold">Save</span>
          </Button>
        </>
      }
    />
  );
};
