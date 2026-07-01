import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { GeneralEditor } from '@/components/shared/settings/GeneralTab/GeneralEditor';
import {
  VariableEditor,
  getInvalidVariableKeys,
} from '@/components/shared/settings/VariableTab/VariableEditor';
import { EnvironmentEditor } from '@/components/shared/settings/EnvironmentTab/EnvironmentEditor';
import { CertificateEditor } from '@/components/shared/settings/TlsTab/CertificateEditor';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
  description: string;
  variables: VariableObjectWithKey[];
  environments: EnvironmentMap;
  selectedEnvironment?: string;
  clientCertificate: ClientCertificate | null;
};

export const CollectionSettingsModal = ({ isOpen, onClose }: CollectionSettingsModalProps) => {
  const { setVariables } = useVariableActions();
  const { setEnvironments, selectEnvironment } = useEnvironmentActions();
  const { setClientCertificate, renameCollection, updateCollection } = useCollectionActions();

  const variables = useVariableStore(selectVariables);
  const environments = useEnvironmentStore(selectEnvironments);
  const selectedEnvironment = useEnvironmentStore(selectSelectedEnvironment);
  const storedCertificate = useCollectionStore((s) => s.collection?.clientCertificate ?? null);
  const collectionTitle = useCollectionStore((s) => s.collection?.title ?? '');
  const collectionDescription = useCollectionStore((s) => s.collection?.description ?? '');

  const buildDraft = (): CollectionDraft => ({
    title: collectionTitle,
    description: collectionDescription,
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
    await updateCollection({ description: draft.description.trim() === '' ? undefined : draft.description });

    // rename must run last
    const newTitle = draft.title.trim();
    if (newTitle.length > 0 && newTitle !== collectionTitle) {
      await renameCollection(newTitle);
    }

    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex h-[80vh] max-w-4xl flex-col p-0 lg:max-w-5xl">
        <div className="flex h-full flex-col">
          {/* Header - Fixed */}
          <div className="shrink-0 px-4 pt-4">
            <DialogHeader>
              <DialogTitle className="font-bold">Collection Settings</DialogTitle>
            </DialogHeader>
          </div>

          {/* Tabs - Takes remaining space */}
          <Tabs defaultValue="general" className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 px-4 py-4">
              <TabsList className="bg-background">
                <TabsTrigger value="general" className="font-light!">
                  General
                </TabsTrigger>
                <TabsTrigger value="variables" className="font-light!">
                  Variables
                </TabsTrigger>
                <TabsTrigger value="environments" className="font-light!">
                  Environments
                </TabsTrigger>
                <TabsTrigger value="tls" className="font-light!">
                  mTLS
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="general" className="m-0 min-h-0 flex-1 overflow-y-auto p-0">
              <div className="h-full overflow-y-auto p-4">
                <GeneralEditor
                  name={draft.title}
                  onNameChange={(title) => update({ title })}
                  description={draft.description}
                  onDescriptionChange={(description) => update({ description })}
                  onCloseCollection={onClose}
                />
              </div>
            </TabsContent>

            <TabsContent value="variables" className="m-0 min-h-0 flex-1 p-0">
              <div className="h-full overflow-y-auto p-4">
                <VariableEditor
                  variables={draft.variables}
                  onVariablesChange={(variables) => update({ variables })}
                />
              </div>
            </TabsContent>

            <TabsContent value="environments" className="m-0 min-h-0 flex-1 p-0">
              <EnvironmentEditor
                environments={draft.environments}
                selectedEnvironment={draft.selectedEnvironment ?? null}
                onEnvironmentsChange={(environments) => update({ environments })}
                onEnvironmentSelect={(key) => update({ selectedEnvironment: key ?? undefined })}
              />
            </TabsContent>

            <TabsContent value="tls" className="m-0 min-h-0 flex-1 overflow-y-auto p-0">
              <CertificateEditor
                certificate={draft.clientCertificate}
                onCertificateChange={(clientCertificate) => update({ clientCertificate })}
              />
            </TabsContent>
          </Tabs>

          {/* Footer - Fixed */}
          <DialogFooter className="shrink-0 p-4">
            <div className="flex gap-2">
              <Button onClick={onClose} variant="outline">
                <span className="leading-4 font-bold">Cancel</span>
              </Button>
              <Button onClick={save} disabled={!canSave}>
                <span className="leading-4 font-bold">Save</span>
              </Button>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};
