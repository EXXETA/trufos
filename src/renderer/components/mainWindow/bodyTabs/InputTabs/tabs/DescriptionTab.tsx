import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { MarkdownPreview } from '@/components/shared/MarkdownPreview';
import { selectRequest, useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { Textarea } from '@/components/ui/textarea';

const DEBOUNCE_MS = 500;

export function DescriptionTab() {
  const request = useCollectionStore(selectRequest);
  const { updateRequest } = useCollectionActions();
  const [value, setValue] = useState(request?.description ?? '');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestRef = useRef(request);
  const valueRef = useRef(value);

  requestRef.current = request;
  valueRef.current = value;

  useEffect(() => {
    setValue(request?.description ?? '');
  }, [request?.id, request?.description]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const next = event.target.value;
      setValue(next);
      updateRequest({ description: next });

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const current = requestRef.current;
        if (current) {
          void RendererEventService.instance.saveRequest({ ...current, description: valueRef.current });
        }
      }, DEBOUNCE_MS);
    },
    [updateRequest]
  );

  if (request == null) return null;

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <Textarea
        value={value}
        onChange={handleChange}
        placeholder="Describe what this request does, gotchas, auth requirements, examples..."
      />
      <div className="bg-muted/10 border-border flex-1 overflow-y-auto rounded border p-4">
        <MarkdownPreview content={value} />
      </div>
    </div>
  );
}
