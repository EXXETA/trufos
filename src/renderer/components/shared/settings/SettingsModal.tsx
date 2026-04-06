import {
  Dialog,
  DialogContent,
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

      <DialogContent className="border-border bg-background-secondary text-foreground flex h-[82vh] max-w-5xl flex-col overflow-hidden border p-0 shadow-lg">
        <Tabs defaultValue="variables" className="flex min-h-0 flex-1 flex-col">
          {/* Header - Fixed */}
          <div className="border-border bg-background-secondary shrink-0 border-b px-6 pt-5 pb-3">
            <DialogHeader>
              <DialogTitle className="text-foreground text-[20px] font-bold">
                Collection Settings
              </DialogTitle>
            </DialogHeader>
            <TabsList className="mt-5 flex gap-3 bg-transparent p-0">
              <TabsTrigger
                value="variables"
                className="text-muted-foreground data-[state=active]:bg-accent-tertiary data-[state=active]:text-accent-primary rounded-full px-4 py-2.5 text-[14px] font-medium transition-all data-[state=active]:shadow-none"
              >
                Variables
              </TabsTrigger>
              <TabsTrigger
                value="environments"
                className="text-muted-foreground data-[state=active]:bg-accent-tertiary data-[state=active]:text-accent-primary rounded-full px-4 py-2.5 text-[14px] font-medium transition-all data-[state=active]:shadow-none"
              >
                Environments
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tabs - Takes remaining space */}

          <TabsContent value="variables" className="m-0 min-h-0 flex-1 p-0">
            <div className="bg-background-primary h-full overflow-x-hidden overflow-y-auto px-6 pt-4 pb-6">
              <VariableEditor
                variables={editorVariables}
                onValidChange={setValid}
                onVariablesChange={setEditorVariables}
              />
            </div>
          </TabsContent>

          <TabsContent value="environments" className="m-0 min-h-0 flex-1 p-0">
            <div className="bg-background-primary h-full overflow-x-hidden overflow-y-auto px-6 pt-4 pb-6">
              <EnvironmentEditor
                environments={editorEnvironments}
                selectedEnvironment={editorSelectedEnvironment}
                onEnvironmentsChange={setEditorEnvironments}
                onEnvironmentSelect={setEditorSelectedEnvironment}
                onValidChange={setEnvironmentValid}
              />
            </div>
          </TabsContent>
          <div className="bg-background-primary flex shrink-0 justify-end px-6 pt-4 pb-6">
            <Button
              onClick={save}
              disabled={!isOverallValid}
              className="h-12.5 px-5 text-[14px] font-semibold transition-all active:scale-[0.98]"
            >
              Save
            </Button>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
