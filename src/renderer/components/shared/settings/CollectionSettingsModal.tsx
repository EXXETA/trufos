import { TabbedDialog } from '@/components/shared/TabbedDialog';
import { GeneralEditor } from '@/components/shared/settings/GeneralTab/GeneralEditor';
import {
  VariableEditor,
  getInvalidVariableKeys,
} from '@/components/shared/settings/VariableTab/VariableEditor';
import { EnvironmentEditor } from '@/components/shared/settings/EnvironmentTab/EnvironmentEditor';
import { CertificateEditor } from '@/components/shared/settings/TlsTab/CertificateEditor';
import { ExportEditor } from '@/components/shared/settings/ExportTab/ExportEditor';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { selectVariables, useVariableActions, useVariableStore } from '@/state/variableStore';
import {
  selectEnvironments,
  selectSelectedEnvironment,
  useEnvironmentActions,
  useEnvironmentStore,
} from '@/state/environmentStore';
import { variableArrayToMap, variableMapToArray } from '@/state/helper/variableMappers';
import { useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { deepEqual } from '@/util/object-util';
import { ClientCertificate } from 'shim/objects/collection';
import { VariableObjectWithKey } from 'shim/objects/variables';
import { EnvironmentMap } from 'shim/objects/environment';

export interface CollectionSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * A single working copy of the editable collection state. The underlying data lives across three
 * stores (collection / variables / environments), but the modal edits one composed draft and commits
 * it back on save. Variables are kept in array form so in-progress/empty/duplicate keys are preserved
 * while editing; they are converted to a map only at commit time.
 */
type CollectionDraft = {
  title: string;
  variables: VariableObjectWithKey[];
  environments: EnvironmentMap;
  selectedEnvironment?: string;
  clientCertificate: ClientCertificate | null;
};

export const CollectionSettingsModal = ({ isOpen, onClose }: CollectionSettingsModalProps) => {
  const { setVariables } = useVariableActions();
  const { setEnvironments, selectEnvironment } = useEnvironmentActions();
  const { setClientCertificate, renameCollection } = useCollectionActions();

  const variables = useVariableStore(selectVariables);
  const environments = useEnvironmentStore(selectEnvironments);
  const selectedEnvironment = useEnvironmentStore(selectSelectedEnvironment);
  const storedCertificate = useCollectionStore((s) => s.collection?.clientCertificate ?? null);
  const collectionTitle = useCollectionStore((s) => s.collection?.title ?? '');

  const buildDraft = (): CollectionDraft => ({
    title: collectionTitle,
    variables: variableMapToArray(variables),
    environments,
    selectedEnvironment,
    clientCertificate: storedCertificate,
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

  useEffect(() => {
    if (isOpen) {
      const initial = buildDraft();
      setDraft(initial);
      setInitialDraft(initial);
    }
  }, [isOpen]);

  const save = async () => {
    // overwrite the generic slices wholesale through their existing store setters.
    await setVariables(variableArrayToMap(draft.variables));
    await setEnvironments(draft.environments);
    await selectEnvironment(draft.selectedEnvironment);
    await setClientCertificate(draft.clientCertificate);

    // rename must run last
    const newTitle = draft.title.trim();
    if (newTitle.length > 0 && newTitle !== collectionTitle) {
      await renameCollection(newTitle);
    }

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
