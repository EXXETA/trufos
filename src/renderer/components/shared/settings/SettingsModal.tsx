import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { FiSettings } from 'react-icons/fi';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import * as React from 'react';
import { useState } from 'react';
import {
  selectCollectionVariables,
  selectEnvironmentVariables,
  useVariableActions,
  useVariableStore,
} from '@/state/variableStore';
import { CollectionVariableTab } from '@/components/shared/settings/variableTabs/CollectionVariableTab';
import {
  variableArrayToMap,
  variableMapToArray,
} from '@/components/shared/settings/variableTabs/helper/EditVariableHelper';
import { EnvironmentVariableTab } from '@/components/shared/settings/variableTabs/EnvironmentVariableTab';
import { SettingsModalFooter } from '@/components/shared/settings/footer/SettingsModalFooter';

export const SettingsModal = () => {
  const actions = useVariableActions();
  const collectionStoreVariables = useVariableStore((state) => selectCollectionVariables(state));
  const environmentStoreVariables = useVariableStore((state) => selectEnvironmentVariables(state));

  const [collectionVariables, setCollectionVariables] = useState(
    variableMapToArray(collectionStoreVariables)
  );
  const [environmentVariables, setEnvironmentVariables] = useState(environmentStoreVariables);
  const [isValid, setValid] = useState(false);
  const [isOpen, setOpen] = useState(true);

  const save = async () => {
    await apply();
    setOpen(false);
  };

  const apply = async () => {
    await actions.setCollectionVariables(variableArrayToMap(collectionVariables));
    await actions.setEnvironmentVariables(environmentVariables);
  };

  const cancel = () => {
    setCollectionVariables(variableMapToArray(collectionStoreVariables));
    setEnvironmentVariables(environmentStoreVariables);
    setOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && cancel()}>
      <DialogTrigger onClick={() => setOpen(true)}>
        <FiSettings className="text-xl ml-2" />
      </DialogTrigger>
      <DialogContent style={{ minWidth: '100vh' }}>
        <DialogHeader className="mt-auto">
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="environmentVariables" className="h-[calc(50vh)]">
          <TabsList>
            <TabsTrigger value="collectionVariables">CollectionVariables</TabsTrigger>
            <TabsTrigger value="environmentVariables">EnvironmentVariables</TabsTrigger>
          </TabsList>
          <TabsContent value="collectionVariables" className="max-h-[50vh] overflow-y-auto">
            <CollectionVariableTab
              variables={collectionVariables}
              onValidChange={setValid}
              onVariablesChange={setCollectionVariables}
            />
          </TabsContent>
          <TabsContent value="environmentVariables" className="max-h-[50vh] overflow-y-auto">
            <EnvironmentVariableTab
              environments={environmentVariables}
              onValidChange={setValid}
              onEnvironmentChange={setEnvironmentVariables}
            />
          </TabsContent>
        </Tabs>
        <DialogFooter className={'bottom-0'}>
          <SettingsModalFooter save={save} valid={isValid} apply={apply} cancel={cancel} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
