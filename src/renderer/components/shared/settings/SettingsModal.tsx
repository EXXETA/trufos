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

      <DialogContent className="bg-muted flex h-[80vh] max-w-4xl flex-col overflow-hidden p-0 lg:max-w-5xl">
        <Tabs defaultValue="variables" className="flex min-h-0 flex-1 flex-col">
          {/* Header - Fixed */}
          <div className="bg-muted shrink-0 px-6 pt-4 pb-3">
            <DialogHeader>
              <DialogTitle className="px-2 leading-tight font-bold">
                Collection Settings
              </DialogTitle>
            </DialogHeader>
            <TabsList className="mt-4 gap-2 bg-transparent">
              <TabsTrigger
                value="variables"
                className="text-text-secondary data-[state=active]:bg-background data-[state=active]:text-foreground rounded-full px-4 py-2"
              >
                Variables
              </TabsTrigger>
              <TabsTrigger
                value="environments"
                className="text-text-secondary data-[state=active]:bg-background data-[state=active]:text-foreground rounded-full px-4 py-2"
              >
                Environments
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tabs - Takes remaining space */}

          <TabsContent value="variables" className="m-0 min-h-0 flex-1 border-0 p-0">
            <div className="bg-background h-full overflow-y-auto px-6 py-4">
              <VariableEditor
                variables={editorVariables}
                onValidChange={setValid}
                onVariablesChange={setEditorVariables}
              />
              <div className="mt-4 flex justify-end">
                <Button
                  onClick={save}
                  disabled={!isOverallValid}
                  variant={isOverallValid ? 'default' : 'defaultDisable'}
                  className="px-5 py-[13px]"
                >
                  Save
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="environments" className="m-0 min-h-0 flex-1 border-0 p-0">
            <div className="bg-background h-full overflow-y-auto px-6 py-4">
              <EnvironmentEditor
                environments={editorEnvironments}
                selectedEnvironment={editorSelectedEnvironment}
                onEnvironmentsChange={setEditorEnvironments}
                onEnvironmentSelect={setEditorSelectedEnvironment}
                onValidChange={setEnvironmentValid}
              />
              <div className="mt-4 flex justify-end">
                <Button
                  onClick={save}
                  disabled={!isOverallValid}
                  variant={isOverallValid ? 'default' : 'defaultDisable'}
                  className="px-5 py-[13px]"
                >
                  Save
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
