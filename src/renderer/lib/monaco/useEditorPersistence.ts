import { editor } from 'monaco-editor';
import { DependencyList, useEffect, useRef } from 'react';
import { useCollectionActions } from '@/state/collectionStore';

/**
 * Manages save/load lifecycle for a Monaco editor model.
 *
 * On every dependency change:
 * - Awaits any in-flight save before loading new content, preventing a race
 *   where the IPC read resolves before the preceding IPC write has landed.
 * - Runs the cleanup save before the next load.
 *
 * Also marks the request as a draft on every user edit (isFlush events are ignored).
 *
 * @param model The Monaco text model to watch and read from.
 * @param deps  Effect dependency array — should include all values used by load/save.
 * @param load  Async function that populates the model with new content.
 * @param save  Function that persists the current model value; receives the current text.
 */
export function useEditorPersistence(
  model: editor.ITextModel,
  deps: DependencyList,
  load: () => Promise<void>,
  save: (value: string) => Promise<unknown>
) {
  const { setDraftFlag } = useCollectionActions();
  const pendingSave = useRef<Promise<unknown> | null>(null);

  useEffect(
    () =>
      model.onDidChangeContent((e) => {
        if (e.isFlush) return;
        setDraftFlag();
      }).dispose,
    []
  );

  useEffect(() => {
    const run = async () => {
      if (pendingSave.current) await pendingSave.current;
      await load();
    };
    void run();
    return () => {
      pendingSave.current = save(model.getValue());
    };
  }, deps);
}
