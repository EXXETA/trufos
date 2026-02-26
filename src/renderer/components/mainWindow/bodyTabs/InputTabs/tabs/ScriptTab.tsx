import MonacoEditor from '@/lib/monaco/MonacoEditor';
import { SCRIPT_EDITOR_OPTIONS } from '@/components/shared/settings/monaco-settings';
import { ScriptType } from 'shim/scripting';
import { SimpleSelect } from '@/components/mainWindow/bodyTabs/InputTabs/SimpleSelect';
import { useState } from 'react';

const SCRIPT_TYPE_OPTIONS: [ScriptType, string][] = [
  [ScriptType.PRE_REQUEST, 'Pre-Request'],
  [ScriptType.POST_RESPONSE, 'Post-Response'],
];

export function ScriptTab() {
  const [scriptType, setScriptType] = useState<ScriptType>(ScriptType.PRE_REQUEST);

  return (
    <div className="flex flex-col h-full">
      <div className="p-2">
        <SimpleSelect
          items={SCRIPT_TYPE_OPTIONS}
          value={scriptType}
          onValueChange={(value) => setScriptType(value as ScriptType)}
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