import { IpcPushStream } from '@/lib/ipc-stream';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { TrufosRequest } from 'shim/objects/request';

export const GRAPHQL_INTROSPECTION_QUERY = `
query IntrospectionQuery {
  __schema {
    queryType { name }
    mutationType { name }
    types {
      kind
      name
      fields(includeDeprecated: true) {
        name
        type {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
            }
          }
        }
      }
    }
  }
}
`.trim();

export function getGraphQLOperationNames(query: string): string[] {
  return Array.from(query.matchAll(/\b(?:query|mutation)\s+([_A-Za-z][_0-9A-Za-z]*)/g)).map(
    (match) => match[1]
  );
}

export function parseGraphQLJsonPayload(input: string) {
  try {
    const parsed = JSON.parse(input) as {
      query?: unknown;
      variables?: unknown;
      operationName?: unknown;
    };
    if (typeof parsed.query !== 'string') return undefined;
    return {
      query: parsed.query,
      variables:
        parsed.variables == null
          ? undefined
          : typeof parsed.variables === 'string'
            ? parsed.variables
            : JSON.stringify(parsed.variables, null, 2),
      operationName: typeof parsed.operationName === 'string' ? parsed.operationName : undefined,
    };
  } catch {
    return undefined;
  }
}

export async function introspectGraphQLSchema(request: TrufosRequest): Promise<string> {
  if (request.body.type !== 'graphql') return '';
  const response = await RendererEventService.instance.sendRequest({
    ...request,
    body: {
      ...request.body,
      query: GRAPHQL_INTROSPECTION_QUERY,
      variables: '{}',
      operationName: 'IntrospectionQuery',
    },
  });
  const body = await (await IpcPushStream.open(response, 'utf-8')).readAll();
  const parsed = JSON.parse(body) as { data?: { __schema?: unknown }; errors?: unknown[] };

  if (parsed.errors?.length) {
    throw new Error('GraphQL introspection returned errors. Paste schema SDL manually instead.');
  }
  if (parsed.data?.__schema == null) {
    throw new Error('GraphQL introspection response did not include __schema.');
  }

  return JSON.stringify(parsed.data.__schema, null, 2);
}
