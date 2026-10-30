import type { McpServer } from '@modelcontextprotocol/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { HttpService } from 'main/network/service/http-service';
import type { TrufosResponse } from 'shim/objects/response';
import { PREVIEW_BYTES } from '../body-pages';
import { jsonResult, type McpUiNotifier, readResponseBodyPage, RequestIdInput } from './shared';

/**
 * Registers the tools of the `execute` permission: actions with effects outside the app.
 * @param server the server to register the tools with
 * @param notifier shows the response in the app
 */
export function registerExecuteTools(server: McpServer, notifier: McpUiNotifier): void {
  server.registerTool(
    'send_request',
    {
      description:
        'Sends a request of the open collection like the send button of Trufos does: with the ' +
        'selected environment, variables, authorization and scripts, including unsaved changes. ' +
        'It is recorded in the history and shown in the app. Returns the status, headers, ' +
        `duration, size, a preview of the first ${PREVIEW_BYTES / 1024} KiB of the body and its ` +
        '`bodyId`. Read more of the body with `read_response_body` or save it with ' +
        '`save_response_body`.',
      inputSchema: z.object({ requestId: RequestIdInput }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    async ({ requestId }, ctx) => {
      const httpService = HttpService.instance;
      const abortKey = randomUUID();
      const abort = () => httpService.abortRequest(abortKey);
      ctx.mcpReq.signal.addEventListener('abort', abort, { once: true });
      let response: TrufosResponse | null;
      try {
        response = await httpService.sendRequest(requestId, abortKey);
      } finally {
        ctx.mcpReq.signal.removeEventListener('abort', abort);
      }
      if (response == null) return jsonResult({ aborted: true });
      notifier.responseReceived(requestId, response);

      const { body, headers, metaInfo } = response;
      const preview = body != null ? await readResponseBodyPage(body.id, 0, PREVIEW_BYTES) : null;
      return jsonResult({
        status: metaInfo.status,
        durationMs: metaInfo.duration,
        size: metaInfo.size,
        contentType: headers['content-type'] ?? null,
        headers,
        bodyId: body?.id ?? null,
        bodySize: body?.size ?? 0,
        preview: preview?.text ?? '',
        previewIsComplete: preview == null || preview.nextOffset == null,
      });
    }
  );
}
