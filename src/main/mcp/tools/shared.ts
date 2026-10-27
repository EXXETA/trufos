import type { CallToolResult } from '@modelcontextprotocol/server';
import path from 'node:path';
import { z } from 'zod';
import { CollectionStateService } from 'main/collection-state/collection-state-service';
import { HistoryService } from 'main/history/history-service';
import { BodyStore } from 'main/network/service/body-store';
import { LatestResponseBodies } from 'main/network/service/latest-response-bodies';
import { CommandError } from 'shim/collection-model';
import type { TrufosRequest } from 'shim/objects/request';
import type { TrufosResponse } from 'shim/objects/response';
import { type BodyPage, readPage } from '../body-pages';

/** Shows what MCP clients do in the app, see `McpServerService`. */
export interface McpUiNotifier {
  /** A request was sent; the response panel shows its response. */
  responseReceived(requestId: string, response: TrufosResponse): void;
  /** The request is selected in the app. */
  showRequest(requestId: string): void;
}

export const RequestIdInput = z.string().describe('The ID of a request of the open collection.');

/** The absolute path of a file, as the working directory of a client is not the one of the app. */
export const AbsolutePath = z
  .string()
  .refine((filePath) => path.isAbsolute(filePath), 'The path must be absolute.');

/**
 * @param value the result of a tool, plain data
 * @returns the result as JSON text, which every client understands
 */
export function jsonResult(value: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

/**
 * Reads files of a request of the open collection, see {@link CollectionStateService.readRequest}.
 * @param requestId the ID of the request
 * @param reader reads the files
 * @returns the result of the reader
 * @throws a {@link CommandError} if the open collection has no such request
 */
export async function readRequestFiles<T>(
  requestId: string,
  reader: (request: TrufosRequest) => Promise<T>
): Promise<T> {
  const read = await CollectionStateService.instance.readRequest(requestId, async (request) => ({
    result: await reader(request),
  }));
  if (read == null) throw new CommandError(`Request ${requestId} does not exist`);
  return read.result;
}

/**
 * Checks that a body can be read by clients: only response bodies can, while the history or the
 * response panel holds them.
 * @param bodyId the ID of the body
 * @returns the size of the body in bytes
 * @throws if the body is no response body or is no longer available
 */
export function checkResponseBody(bodyId: string): number {
  const isResponseBody =
    HistoryService.instance.hasResponseBody(bodyId) || LatestResponseBodies.instance.has(bodyId);
  const size = isResponseBody ? BodyStore.instance.getSize(bodyId) : undefined;
  if (size == null) {
    throw new Error(
      `The response body ${bodyId} is not available (anymore). Bodies live while the request ` +
        'history or the latest response of a request holds them, at most until the app quits. ' +
        'Send the request again to get a new one.'
    );
  }
  return size;
}

/**
 * Reads a page of a response body, see {@link checkResponseBody} and {@link readPage}.
 * @param bodyId the ID of the body
 * @param offset the offset of the first byte of the page
 * @param length the maximum number of bytes of the page
 */
export async function readResponseBodyPage(
  bodyId: string,
  offset: number,
  length: number
): Promise<BodyPage> {
  const totalSize = checkResponseBody(bodyId);
  const stream = BodyStore.instance.openBody(bodyId, { start: offset, end: offset + length - 1 });
  // cannot happen, the body was checked synchronously before
  if (stream == null) throw new Error(`The response body ${bodyId} is not available.`);
  return await readPage(stream, offset, totalSize);
}
