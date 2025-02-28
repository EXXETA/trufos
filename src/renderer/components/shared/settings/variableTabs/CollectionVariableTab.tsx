import { VariableEditor } from '@/components/shared/settings/variableTabs/table/VariableEditor';
import { VariableObjectWithKey } from 'shim/objects/variables';

export interface CollectionVariableTabProps {
  variables: VariableObjectWithKey[];
  onValidChange?: (valid: boolean) => void;
  onVariablesChange?: (variables: VariableObjectWithKey[]) => void;
}

export const CollectionVariableTab = ({
  variables,
  onValidChange,
  onVariablesChange,
}: CollectionVariableTabProps) => {
  return (
    <VariableEditor
      className="p-4 relative"
      variables={variables}
      onValidChange={onValidChange}
      onVariablesChange={onVariablesChange}
    ></VariableEditor>
  );
};
