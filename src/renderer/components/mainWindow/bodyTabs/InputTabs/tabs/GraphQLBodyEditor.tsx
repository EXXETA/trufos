import { FC, useEffect, useRef, useState, useCallback } from 'react';
import MonacoEditor from '@/lib/monaco/MonacoEditor';
import { getBodyModel, getVariablesModel } from '@/lib/monaco/models';
import { selectRequest, useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { REQUEST_EDITOR_OPTIONS } from '@/components/shared/settings/monaco-settings';
import { ResizablePanel, ResizablePanelGroup, ResizableHandle } from '@/components/ui/resizable';
import { editor } from 'monaco-editor';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { WandSparkles, RefreshCw } from 'lucide-react';
import { introspectGraphQLSchema } from '@/lib/monaco/graphql-autocomplete';
import { buildUrl } from 'shim/objects/url';

export const GraphQLBodyEditor: FC = () => {
  const { setDraftFlag } = useCollectionActions();
  const selectedRequestId = useCollectionStore((state) => state.selectedRequestId);
  const request = useCollectionStore(selectRequest)!;

  const [isIntrospecting, setIsIntrospecting] = useState(false);

  const queryEditorRef = useRef<editor.ICodeEditor | undefined>(undefined);
  const varsEditorRef = useRef<editor.ICodeEditor | undefined>(undefined);

  // Listen for changes on query/variables models to set draft flag
  useEffect(() => {
    if (selectedRequestId == null) return;
    const model = getBodyModel(selectedRequestId);
    const varModel = getVariablesModel(selectedRequestId);

    // Explicitly set the language of the models when this editor handles them
    editor.setModelLanguage(model, 'graphql');
    if (varModel) {
      editor.setModelLanguage(varModel, 'json');
    }

    const disposables = [
      model.onDidChangeContent((e) => {
        if (e.isFlush) return;
        setDraftFlag();
      }),
    ];

    if (varModel) {
      disposables.push(
        varModel.onDidChangeContent((e) => {
          if (e.isFlush) return;
          setDraftFlag();
        })
      );
    }

    return () => disposables.forEach((d) => d.dispose());
  }, [selectedRequestId]);

  const handleFormat = useCallback(async () => {
    await queryEditorRef.current?.getAction('editor.action.formatDocument')?.run();
    await varsEditorRef.current?.getAction('editor.action.formatDocument')?.run();
  }, []);

  const handleIntrospect = async () => {
    if (!request) return;
    setIsIntrospecting(true);
    try {
      const urlStr = buildUrl(request.url);
      await introspectGraphQLSchema(request.id, urlStr, request.headers);
    } finally {
      setIsIntrospecting(false);
    }
  };

  if (selectedRequestId == null) return null;

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between px-4 pb-2">
        <span className="text-text-secondary text-xs font-semibold tracking-wider uppercase">
          GraphQL Editor
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 text-xs"
            onClick={handleIntrospect}
            disabled={isIntrospecting}
          >
            <RefreshCw size={14} className={cn({ 'animate-spin': isIntrospecting })} />
            Introspect Schema
          </Button>
          <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs" onClick={handleFormat}>
            <WandSparkles size={14} />
            Format
          </Button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <ResizablePanelGroup orientation="horizontal" className="h-full w-full">
          <ResizablePanel defaultSize={60} minSize={30} className="relative h-full">
            <div className="absolute inset-0 flex flex-col">
              <div className="text-text-disabled px-4 py-1 text-[10px] font-medium uppercase">
                Query
              </div>
              <div className="relative flex-1">
                <MonacoEditor
                  height="100%"
                  className="absolute h-full w-full"
                  options={REQUEST_EDITOR_OPTIONS}
                  language="graphql"
                  model={getBodyModel(selectedRequestId)}
                  onMount={(editorInstance) => {
                    queryEditorRef.current = editorInstance;
                  }}
                />
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={40} minSize={20} className="relative h-full">
            <div className="absolute inset-0 flex flex-col">
              <div className="text-text-disabled px-4 py-1 text-[10px] font-medium uppercase">
                Variables (JSON)
              </div>
              <div className="relative flex-1">
                {getVariablesModel(selectedRequestId) && (
                  <MonacoEditor
                    height="100%"
                    className="absolute h-full w-full"
                    options={REQUEST_EDITOR_OPTIONS}
                    language="json"
                    model={getVariablesModel(selectedRequestId)!}
                    onMount={(editorInstance) => {
                      varsEditorRef.current = editorInstance;
                    }}
                  />
                )}
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
};
