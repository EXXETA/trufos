import { useCallback, useEffect, useMemo, useState } from 'react';
import MonacoEditor from '@/lib/monaco/MonacoEditor';
import { getBodyModel, getVariablesModel } from '@/lib/monaco/models';
import { REQUEST_EDITOR_OPTIONS } from '@/components/shared/settings/monaco-settings';
import { Language } from '@/lib/monaco/language';
import {
  getGraphQLOperationNames,
  introspectGraphQLSchema,
  parseGraphQLJsonPayload,
} from '@/lib/graphql';
import { Button } from '@/components/ui/button';
import { showError } from '@/error/errorHandler';
import { selectRequest, useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { languages } from 'monaco-editor';

export function GraphQLBodyEditor() {
  const [isIntrospecting, setIsIntrospecting] = useState(false);
  const [queryText, setQueryText] = useState('');
  const { setDraftFlag, setRequestBody } = useCollectionActions();
  const request = useCollectionStore(selectRequest)!;
  const selectedRequestId = useCollectionStore((state) => state.selectedRequestId);

  const operationNames = useMemo(() => getGraphQLOperationNames(queryText), [queryText]);

  useEffect(() => {
    if (selectedRequestId == null) return;
    const bodyModel = getBodyModel(selectedRequestId);
    setQueryText(bodyModel.getValue());
    const bodyDisposable = bodyModel.onDidChangeContent((event) => {
      if (!event.isFlush) setDraftFlag();
      setQueryText(bodyModel.getValue());
    });
    const variablesDisposable = getVariablesModel(selectedRequestId).onDidChangeContent((event) => {
      if (!event.isFlush) setDraftFlag();
    });
    return () => {
      bodyDisposable.dispose();
      variablesDisposable.dispose();
    };
  }, [selectedRequestId, setDraftFlag]);

  useEffect(() => {
    if (request.body.type !== 'graphql') return;
    const fields = getSchemaFieldNames(request.body.schema ?? '');
    if (fields.length === 0) return;
    const disposable = languages.registerCompletionItemProvider(Language.GRAPHQL, {
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };
        return {
          suggestions: fields.map((field) => ({
            label: field,
            kind: languages.CompletionItemKind.Field,
            insertText: field,
            range,
          })),
        };
      },
    });
    return () => disposable.dispose();
  }, [request.body]);

  const updateGraphQLBody = useCallback(
    (updates: { operationName?: string; schema?: string }) => {
      if (request.body.type !== 'graphql') return;
      setRequestBody({ ...request.body, ...updates });
    },
    [request.body, setRequestBody]
  );

  const introspect = useCallback(async () => {
    if (request.body.type !== 'graphql') return;
    try {
      setIsIntrospecting(true);
      const schema = await introspectGraphQLSchema(request);
      updateGraphQLBody({ schema });
    } catch (error) {
      showError(error);
    } finally {
      setIsIntrospecting(false);
    }
  }, [request, updateGraphQLBody]);

  const extractJsonBody = useCallback(() => {
    if (selectedRequestId == null) return;
    const payload = parseGraphQLJsonPayload(getBodyModel(selectedRequestId).getValue());
    if (payload == null) return;
    getBodyModel(selectedRequestId).setValue(payload.query);
    getVariablesModel(selectedRequestId).setValue(payload.variables ?? '{}');
    updateGraphQLBody({ operationName: payload.operationName });
    setDraftFlag();
  }, [selectedRequestId, setDraftFlag, updateGraphQLBody]);

  if (selectedRequestId == null || request.body.type !== 'graphql') return null;

  return (
    <div className="grid h-full grid-rows-[auto_minmax(0,1fr)] gap-3 px-4 pb-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">GraphQL body</span>
          <Button className="h-8" size="sm" variant="ghost" onClick={extractJsonBody}>
            Extract JSON body
          </Button>
        </div>
        <select
          className="bg-background border-border h-8 rounded border px-2 text-sm"
          value={request.body.operationName ?? ''}
          onChange={(event) =>
            updateGraphQLBody({ operationName: event.target.value || undefined })
          }
        >
          <option value="">operationName</option>
          {operationNames.map((operationName) => (
            <option key={operationName} value={operationName}>
              {operationName}
            </option>
          ))}
        </select>
        <Button
          className="h-8"
          size="sm"
          variant="ghost"
          onClick={introspect}
          disabled={isIntrospecting}
        >
          {isIntrospecting ? 'Introspecting...' : 'Introspect'}
        </Button>
      </div>

      <div className="grid min-h-0 grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] gap-3">
        <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-1">
          <span className="text-muted-foreground text-xs">Query</span>
          <MonacoEditor
            className="min-h-0"
            height="100%"
            language={Language.GRAPHQL}
            model={getBodyModel(selectedRequestId)}
            options={REQUEST_EDITOR_OPTIONS}
          />
        </div>
        <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
          <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-1">
            <span className="text-muted-foreground text-xs">Variables JSON</span>
            <MonacoEditor
              className="min-h-0"
              height="100%"
              language={Language.JSON}
              model={getVariablesModel(selectedRequestId)}
              options={REQUEST_EDITOR_OPTIONS}
            />
          </div>
          <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-1">
            <span className="text-muted-foreground text-xs">Schema fallback</span>
            <textarea
              className="bg-background border-border min-h-0 resize-none rounded border p-2 font-mono text-sm"
              placeholder="Paste introspection JSON or SDL"
              value={request.body.schema ?? ''}
              onChange={(event) => updateGraphQLBody({ schema: event.target.value })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function getSchemaFieldNames(schema: string): string[] {
  if (!schema.trim()) return [];
  try {
    const parsed = JSON.parse(schema) as {
      types?: { name?: string; fields?: { name?: string }[] }[];
      queryType?: { name?: string };
      mutationType?: { name?: string };
    };
    const rootNames = new Set([parsed.queryType?.name, parsed.mutationType?.name].filter(Boolean));
    return Array.from(
      new Set(
        (parsed.types ?? [])
          .filter((type) => rootNames.has(type.name))
          .flatMap((type) => type.fields ?? [])
          .map((field) => field.name)
          .filter((field): field is string => field != null)
      )
    );
  } catch {
    const matches = schema.matchAll(/\b(?:type|extend\s+type)\s+(?:Query|Mutation)\s*{([^}]*)}/gms);
    return Array.from(
      new Set(
        Array.from(matches)
          .flatMap((match) => match[1].split('\n'))
          .map((line) => line.trim().match(/^([_A-Za-z][_0-9A-Za-z]*)/)?.[1])
          .filter((field): field is string => field != null)
      )
    );
  }
}
