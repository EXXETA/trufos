import MonacoEditor from '@/lib/monaco/MonacoEditor';
import { SCRIPT_EDITOR_OPTIONS } from '@/components/shared/settings/monaco-settings';
import { ScriptType } from 'shim/scripting';
import { SimpleSelect } from '@/components/mainWindow/bodyTabs/InputTabs/SimpleSelect';
import { useCollectionActions, useCollectionStore } from '@/state/collectionStore';

const SCRIPT_TYPE_OPTIONS: [ScriptType, string][] = [
  [ScriptType.PRE_REQUEST, 'Pre-Request'],
  [ScriptType.POST_RESPONSE, 'Post-Response'],
];

export function ScriptTab() {
  const scriptType = useCollectionStore((state) => state.currentScriptType);
  const { setCurrentScriptType } = useCollectionActions();

  return (
    <div className="flex flex-col h-full">
      <div className="p-2">
        <SimpleSelect
          items={SCRIPT_TYPE_OPTIONS}
          value={scriptType}
          onValueChange={(value) => setCurrentScriptType(value as ScriptType)}
        />
      </div>
      <div className="relative flex-1">
        <MonacoEditor
          height="100%"
          className="absolute h-full"
          language="javascript"
          options={SCRIPT_EDITOR_OPTIONS}
        />
      </div>
    </div>
  );
}