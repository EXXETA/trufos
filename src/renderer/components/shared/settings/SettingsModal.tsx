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

      <DialogContent className="flex h-[80vh] max-w-4xl flex-col overflow-hidden p-0 lg:max-w-5xl">
        <Tabs defaultValue="variables" className="flex min-h-0 flex-1 flex-col">
          {/* Header - Fixed */}
          <div className="shrink-0 bg-[#1F1F1F] px-6 pt-4 pb-3">
            <DialogHeader>
              <DialogTitle className="px-1 text-xl leading-tight font-bold">
                Collection Settings
              </DialogTitle>
            </DialogHeader>
            <TabsList className="mt-4 gap-1 bg-transparent p-1">
              <TabsTrigger
                value="variables"
                className="text-text-secondary rounded-full border border-transparent px-5 py-[10px] text-[15px] transition-colors hover:text-[#2F6F83] data-[state=active]:bg-[#193641] data-[state=active]:text-[#2F6F83]"
              >
                Variables
              </TabsTrigger>

              <TabsTrigger
                value="environments"
                className="text-text-secondary rounded-full border border-transparent px-5 py-[10px] text-[15px] transition-colors hover:text-[#2F6F83] data-[state=active]:bg-[#193641] data-[state=active]:text-[#2F6F83]"
              >
                Environments
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tabs - Takes remaining space */}

          <TabsContent value="variables" className="m-0 min-h-0 flex-1 border-0 p-0">
            <div className="h-full overflow-y-auto bg-[#111111] px-6 py-4">
              <VariableEditor
                variables={editorVariables}
                onValidChange={setValid}
                onVariablesChange={setEditorVariables}
              />
            </div>
          </TabsContent>

          <TabsContent value="environments" className="m-0 min-h-0 flex-1 border-0 p-0">
            <div className="h-full overflow-y-auto bg-[#111111] px-6 py-4">
              <EnvironmentEditor
                environments={editorEnvironments}
                selectedEnvironment={editorSelectedEnvironment}
                onEnvironmentsChange={setEditorEnvironments}
                onEnvironmentSelect={setEditorSelectedEnvironment}
                onValidChange={setEnvironmentValid}
              />
            </div>
          </TabsContent>
          <div className="flex shrink-0 justify-end bg-[#111111] px-6 py-4">
            <Button
              onClick={save}
              disabled={!isOverallValid}
              variant={isOverallValid ? 'default' : 'defaultDisable'}
              className="px-5 py-[13px]"
            >
              Save
            </Button>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
