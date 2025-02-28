import { VariableObjectWithKey } from 'shim/objects/variables';
import { useEffect, useState } from 'react';
import {
  Sidebar,
  SidebarHeader,
  SidebarMenuButton,
  SidebarProvider,
} from '@/components/ui/sidebar';
import { EnvironmentMap } from 'shim/objects/environment';
import { variableMapToArray } from '@/components/shared/settings/variableTabs/helper/EditVariableHelper';
import { VariableEditor } from '@/components/shared/settings/variableTabs/table/VariableEditor';

export interface EnvironmentVariableEditorProps {
  environments: EnvironmentMap;
  onValidChange?: (valid: boolean) => void;
  onVariablesChange?: (variables: VariableObjectWithKey[]) => void;
}

/** A component that allows adding, editing and removing variables */
export const EnvironmentVariableTab = ({
  environments,
  onVariablesChange,
  onValidChange,
}: EnvironmentVariableEditorProps) => {
  const environmentList = Object.keys(environments);
  const firstEnvironmentKey = environmentList[0] as keyof EnvironmentMap;
  const firstEnvironment = environments[firstEnvironmentKey] ?? {};
  const [editorEnvironmentVariables, setEditorEnvironmentVariables] = useState(
    variableMapToArray(firstEnvironment)
  );
  const [selectedEnvironment, setSelectedEnvironment] = useState(environmentList[0]);

  useEffect(() => {
    const selectedEnvironmentKey = selectedEnvironment as keyof EnvironmentMap;
    const selectedEnvironmentVariables = environments[selectedEnvironmentKey] ?? {};
    setEditorEnvironmentVariables(variableMapToArray(selectedEnvironmentVariables));
  }, [selectedEnvironment, environments]);

  return (
    <div className="p-4 flex">
      <SidebarProvider>
        <Sidebar collapsible={'none'}>
          <SidebarHeader>Environments</SidebarHeader>
          {environmentList.map((environment) => (
            <SidebarMenuButton
              isActive={environment === selectedEnvironment}
              onClick={() => setSelectedEnvironment(environment)}
              className="mr-4"
              key={environment}
            >
              {environment}
            </SidebarMenuButton>
          ))}
          <SidebarMenuButton> + Add Environment</SidebarMenuButton>
        </Sidebar>
        <VariableEditor
          className={'p-4 m-1 flex-1'}
          variables={editorEnvironmentVariables}
          onVariablesChange={onVariablesChange}
          onValidChange={onValidChange}
        />
      </SidebarProvider>
    </div>
  );
};
