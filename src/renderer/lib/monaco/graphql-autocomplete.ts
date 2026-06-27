import { editor, Position, languages } from 'monaco-editor';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { toast } from 'sonner';
import { TrufosHeader } from 'shim/objects/headers';

const eventService = RendererEventService.instance;

export interface GraphQLTypeRef {
  kind: string;
  name?: string;
  ofType?: GraphQLTypeRef;
}

export interface GraphQLField {
  name: string;
  description?: string;
  type: GraphQLTypeRef;
}

export interface GraphQLType {
  name: string;
  kind: string;
  fields?: GraphQLField[];
}

export interface GraphQLSchema {
  queryType?: { name: string };
  mutationType?: { name: string };
  types: GraphQLType[];
}

export const graphqlSchemaRegistry = new Map<string, GraphQLSchema>();

export async function introspectGraphQLSchema(
  requestId: string,
  url: string,
  headers: TrufosHeader[]
) {
  try {
    const result = (await eventService.introspectSchema(url, headers)) as {
      data?: { __schema?: GraphQLSchema };
    };
    if (result && result.data && result.data.__schema) {
      graphqlSchemaRegistry.set(requestId, result.data.__schema);
      toast.success('Schema introspected successfully');
      return true;
    } else {
      toast.error('Invalid introspection response');
      return false;
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    toast.error(`Introspection failed: ${errorMessage}`);
    return false;
  }
}

function getGraphQLPath(text: string): string[] {
  const path: string[] = [];
  const cleanText = text
    .replace(/#.*$/gm, '') // strip comments
    .replace(/"([^"\\]|\\.)*"/g, '""'); // strip string literals

  const tokens = cleanText.match(/[{}]|[_A-Za-z][_0-9A-Za-z]*/g) || [];

  let lastWord = '';
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === '{') {
      if (lastWord && !['query', 'mutation', 'subscription', 'fragment'].includes(lastWord)) {
        path.push(lastWord);
      } else {
        path.push('__root');
      }
      lastWord = '';
    } else if (token === '}') {
      path.pop();
      lastWord = '';
    } else {
      lastWord = token;
    }
  }
  return path;
}

function getNamedType(typeRef: GraphQLTypeRef | undefined): string | null {
  if (!typeRef) return null;
  if (typeRef.name) return typeRef.name;
  return getNamedType(typeRef.ofType);
}

export class GraphQLCompletionItemsProvider implements languages.CompletionItemProvider {
  triggerCharacters = [' ', '\n', '{'];

  provideCompletionItems(
    model: editor.ITextModel,
    position: Position
  ): languages.ProviderResult<languages.CompletionList> {
    // Extract requestId from model URI
    const uriPath = model.uri.path;
    const match = uriPath.match(/^\/requests\/([^/]+)\/body$/);
    if (!match) return { suggestions: [] };
    const requestId = match[1];

    const schema = graphqlSchemaRegistry.get(requestId);
    if (!schema) return { suggestions: [] };

    // Get text up to the cursor
    const textBeforeCursor = model.getValueInRange({
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: position.lineNumber,
      endColumn: position.column,
    });

    const path = getGraphQLPath(textBeforeCursor);
    const defaultRange = {
      startLineNumber: position.lineNumber,
      endLineNumber: position.lineNumber,
      startColumn: position.column,
      endColumn: position.column,
    };

    if (path.length === 0) {
      // Suggest top-level operation keywords
      return {
        suggestions: [
          {
            label: 'query',
            kind: languages.CompletionItemKind.Keyword,
            insertText: 'query {\n\t$0\n}',
            insertTextRules: languages.CompletionInsertTextRule.InsertAsSnippet,
            range: defaultRange,
          },
          {
            label: 'mutation',
            kind: languages.CompletionItemKind.Keyword,
            insertText: 'mutation {\n\t$0\n}',
            insertTextRules: languages.CompletionInsertTextRule.InsertAsSnippet,
            range: defaultRange,
          },
        ],
      };
    }

    // Determine current type in the path
    let currentTypeName: string | null = schema.queryType?.name || 'Query';

    // Check if the first block is mutation or query
    const firstBlock = textBeforeCursor.trim().split(/\s+/)[0];
    if (firstBlock === 'mutation') {
      currentTypeName = schema.mutationType?.name || 'Mutation';
    }

    const typesMap = new Map<string, GraphQLType>(schema.types.map((t) => [t.name, t]));

    for (let i = 0; i < path.length; i++) {
      const part = path[i];
      if (part === '__root') continue;

      const currentType = typesMap.get(currentTypeName || '');
      if (!currentType) {
        currentTypeName = null;
        break;
      }

      const field = currentType.fields?.find((f) => f.name === part);
      if (!field) {
        currentTypeName = null;
        break;
      }

      currentTypeName = getNamedType(field.type);
    }

    if (!currentTypeName) return { suggestions: [] };

    const activeType = typesMap.get(currentTypeName);
    if (!activeType || !activeType.fields) return { suggestions: [] };

    const word = model.getWordUntilPosition(position);
    const range = {
      startLineNumber: position.lineNumber,
      endLineNumber: position.lineNumber,
      startColumn: word.startColumn,
      endColumn: word.endColumn,
    };

    const suggestions = activeType.fields.map((field) => {
      const isObjectOrList =
        field.type.kind === 'OBJECT' ||
        field.type.kind === 'LIST' ||
        (field.type.ofType &&
          (field.type.ofType.kind === 'OBJECT' || field.type.ofType.kind === 'LIST'));

      const insertText = isObjectOrList ? `${field.name} {\n\t$0\n}` : field.name;
      const insertRule = isObjectOrList
        ? languages.CompletionInsertTextRule.InsertAsSnippet
        : undefined;

      return {
        label: field.name,
        kind: isObjectOrList
          ? languages.CompletionItemKind.Folder
          : languages.CompletionItemKind.Field,
        insertText,
        insertTextRules: insertRule,
        detail: field.description || getNamedType(field.type) || '',
        range,
      };
    });

    return { suggestions };
  }
}
