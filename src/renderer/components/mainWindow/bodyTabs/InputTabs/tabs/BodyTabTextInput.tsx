import { REQUEST_EDITOR_OPTIONS } from '@/components/shared/settings/monaco-settings';
import { Language } from '@/lib/monaco/language';
import { cn } from '@/lib/utils';
import { selectRequest, useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import MonacoEditor from '@/lib/monaco/MonacoEditor';
import { useEffect } from 'react';
import { REQUEST_MODEL } from '@/lib/monaco/models';
import { setRequestTextBody } from '@/state/helper/collectionUtil';
import { RendererEventService } from '@/services/event/renderer-event-service';

const eventService = RendererEventService.instance;

interface BodyTabTextInputProps {
  language: Language;
  className?: string;
}

export default function BodyTabTextInput({ language, className }: BodyTabTextInputProps) {
  const { setRequestEditor, setDraftFlag } = useCollectionActions();
  const request = useCollectionStore(selectRequest);
  const selectedRequestId = useCollectionStore((state) => state.selectedRequestId);

  // using this instead of onChange() event to avoid receiving the whole editor content
  useEffect(
    () =>
      REQUEST_MODEL.onDidChangeContent((e) => {
        if (e.isFlush) return; // ignore initial load events
        setDraftFlag();
      }).dispose,
    []
  );

  // Load content when request changes; save current content on cleanup.
  // React guarantees cleanup runs before the next effect, so the model
  // still holds the old content when saving.
  useEffect(() => {
    void setRequestTextBody(request);
    return () => {
      if (request != null) {
        void eventService.saveRequest(request, REQUEST_MODEL.getValue());
      }
    };
  }, [selectedRequestId]);

  return (
    <MonacoEditor
      height="100%"
      className={cn('absolute h-full', className)}
      options={REQUEST_EDITOR_OPTIONS}
      language={language}
      onMount={setRequestEditor}
    />
  );
}
