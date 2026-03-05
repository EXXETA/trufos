import MonacoEditor from '@/lib/monaco/MonacoEditor';
import { SCRIPT_EDITOR_OPTIONS } from '@/components/shared/settings/monaco-settings';
import { ScriptType } from 'shim/scripting';
import { SimpleSelect } from '@/components/mainWindow/bodyTabs/InputTabs/SimpleSelect';
import { selectRequest, useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { Divider } from '@/components/shared/Divider';
import { useEffect } from 'react';
import { SCRIPT_MODEL } from '@/lib/monaco/models';
import { setScriptContent } from '@/state/helper/collectionUtil';
import { RendererEventService } from '@/services/event/renderer-event-service';

const eventService = RendererEventService.instance;

const SCRIPT_TYPE_OPTIONS: [ScriptType, string][] = [
  [ScriptType.PRE_REQUEST, 'Pre-Request'],
  [ScriptType.POST_RESPONSE, 'Post-Response'],
];

export function ScriptTab() {
  const scriptType = useCollectionStore((state) => state.currentScriptType);
  const selectedRequestId = useCollectionStore((state) => state.selectedRequestId);
  const request = useCollectionStore(selectRequest);
  const { setCurrentScriptType } = useCollectionActions();

  // Load content when request or script type changes; save current content on cleanup.
  // React guarantees cleanup runs before the next effect, so the model
  // still holds the old content when saving.
  useEffect(() => {
    void setScriptContent(request, scriptType);
    return () => {
      if (request != null) {
        void eventService.saveScript(request, scriptType, SCRIPT_MODEL.getValue());
      }
    };
  }, [selectedRequestId, scriptType]);

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
        />
      </div>
    </div>
  );
}
