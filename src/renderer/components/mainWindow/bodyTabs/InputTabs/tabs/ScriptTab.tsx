import MonacoEditor from '@/lib/monaco/MonacoEditor';
import { SCRIPT_EDITOR_OPTIONS } from '@/components/shared/settings/monaco-settings';
import { ScriptType } from 'shim/scripting';
import { SimpleSelect } from '@/components/mainWindow/bodyTabs/InputTabs/SimpleSelect';
import { useCollectionActions, useCollectionStore } from '@/state/appStore';
import { Divider } from '@/components/shared/Divider';
import { getScriptModel } from '@/lib/monaco/models';
import { useEffect } from 'react';

const SCRIPT_TYPE_OPTIONS: [ScriptType, string][] = [
  [ScriptType.PRE_REQUEST, 'Pre-Request'],
  [ScriptType.POST_RESPONSE, 'Post-Response'],
];

export function ScriptTab() {
  const scriptType = useCollectionStore((state) => state.currentScriptType);
  const selectedRequestId = useCollectionStore((state) => state.selectedRequestId);
  const { setCurrentScriptType, setDraftFlag } = useCollectionActions();

  useEffect(() => {
    if (selectedRequestId == null) return;
    const model = getScriptModel(selectedRequestId, scriptType);
    const disposable = model.onDidChangeContent((e) => {
      if (e.isFlush) return;
      setDraftFlag();
    });
    return () => disposable.dispose();
  }, [selectedRequestId, scriptType]);

  if (selectedRequestId == null) return null;

  return (
    <div className="flex h-full flex-col gap-4 pt-2">
      <div className="space-y-2 px-4">
        <div className="px-2">
          <SimpleSelect
            items={SCRIPT_TYPE_OPTIONS}
            value={scriptType}
            onValueChange={(value) => setCurrentScriptType(value as ScriptType)}
          />
        </div>
        <Divider />
      </div>
      <div className="relative flex-1">
        <MonacoEditor
          height="100%"
          className="absolute h-full"
          language="javascript"
          options={SCRIPT_EDITOR_OPTIONS}
          model={getScriptModel(selectedRequestId, scriptType)}
        />
      </div>
    </div>
  );
}
