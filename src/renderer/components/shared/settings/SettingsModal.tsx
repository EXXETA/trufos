import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { FiSettings } from 'react-icons/fi';
import { VariableEditor } from '@/components/shared/settings/VariableTab/VariableEditor';
import { EnvironmentEditor } from '@/components/shared/settings/EnvironmentTab/EnvironmentEditor';
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

export const SettingsModal = () => {
  const { setVariables } = useVariableActions();
  const { setEnvironments, selectEnvironment } = useEnvironmentActions();

  const variables = useVariableStore(selectVariables);
  const environments = useEnvironmentStore(selectEnvironments);
  const selectedEnvironment = useEnvironmentStore(selectSelectedEnvironment);

  const [editorVariables, setEditorVariables] = useState(variableMapToArray(variables));
  const [editorEnvironments, setEditorEnvironments] = useState(environments);
  const [editorSelectedEnvironment, setEditorSelectedEnvironment] = useState(selectedEnvironment);
  const [isValid, setValid] = useState(false);
  const [isEnvironmentValid, setEnvironmentValid] = useState(true);
  const [isOpen, setOpen] = useState(false);
  const isOverallValid = isValid && isEnvironmentValid;

  useEffect(() => {
    if (isOpen) {
      setEditorVariables(variableMapToArray(variables));
      setEditorEnvironments(environments);
      setEditorSelectedEnvironment(selectedEnvironment);
    }
  }, [isOpen]);

  const apply = async () => {
    await setVariables(variableArrayToMap(editorVariables));
    await setEnvironments(editorEnvironments);
    await selectEnvironment(editorSelectedEnvironment);
  };

  // We intentionally do NOT call cancel() after a successful save because cancel() reverts
  // the editor state to the store snapshot at the time of closing. When save() previously
  // closed the dialog, the onOpenChange handler invoked cancel(), briefly overriding the
  // just-applied changes until store effects re-synchronized. This created the perception
  // that changes were not saved. By separating the close behavior we avoid that flicker/race.
  const save = async () => {
    await apply();
    setOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogTrigger onClick={() => setOpen(true)}>
        <FiSettings className="ml-2 text-xl" />
      </DialogTrigger>

      <DialogContent className="flex h-[80vh] max-w-4xl flex-col p-0 lg:max-w-5xl">
        <div className="flex h-full flex-col">
          {/* Header - Fixed */}
          <div className="shrink-0 px-4 pt-4">
            <DialogHeader>
              <DialogTitle className="font-bold">Collection Settings</DialogTitle>
            </DialogHeader>
          </div>

          {/* Tabs - Takes remaining space */}
          <Tabs defaultValue="variables" className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 px-4 py-4">
              <TabsList className="bg-background">
                <TabsTrigger value="variables" className="font-light!">
                  Variables
                </TabsTrigger>
                <TabsTrigger value="environments" className="font-light!">
                  Environments
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="variables" className="m-0 min-h-0 flex-1 p-0">
              <div className="h-full overflow-y-auto p-4">
                <VariableEditor
                  variables={editorVariables}
                  onValidChange={setValid}
                  onVariablesChange={setEditorVariables}
                />
              </div>
            </TabsContent>

            <TabsContent value="environments" className="m-0 min-h-0 flex-1 p-0">
              <EnvironmentEditor
                environments={editorEnvironments}
                selectedEnvironment={editorSelectedEnvironment}
                onEnvironmentsChange={setEditorEnvironments}
                onEnvironmentSelect={setEditorSelectedEnvironment}
                onValidChange={setEnvironmentValid}
              />
            </TabsContent>
          </Tabs>

          {/* Footer - Fixed */}
          <DialogFooter className="shrink-0 p-4">
            <div className="flex gap-2">
              <Button onClick={() => setOpen(false)} variant="outline">
                <span className="font-bold leading-4">Cancel</span>
              </Button>
              <Button
                onClick={save}
                disabled={!isOverallValid}
                variant={isOverallValid ? 'default' : 'defaultDisable'}
              >
                <span className="font-bold leading-4">Save</span>
              </Button>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};
