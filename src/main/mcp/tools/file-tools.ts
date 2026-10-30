import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { BodyStore } from 'main/network/service/body-store';
import { isErrnoException } from 'shim/error/errno';
import { AbsolutePath, checkResponseBody, jsonResult } from './shared';

/**
 * Registers the tools of the `writeFiles` permission.
 * @param server the server to register the tools with
 */
export function registerFileTools(server: McpServer): void {
  server.registerTool(
    'save_response_body',
    {
      description:
        'Saves a whole response body to a new file, e.g. to process a large or binary body. ' +
        'Never replaces an existing file.',
      inputSchema: z.object({
        bodyId: z.string().describe('The `bodyId` of a response.'),
        path: AbsolutePath.describe(
          'The absolute path of the file to create. It must not exist yet.'
        ),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async ({ bodyId, path: filePath }) => {
      const size = checkResponseBody(bodyId);
      try {
        await BodyStore.instance.saveTo(bodyId, filePath, { exclusive: true });
      } catch (error) {
        if (isErrnoException(error) && error.code === 'EEXIST') {
          throw new Error(`The file ${filePath} exists already. Choose another path.`, {
            cause: error,
          });
        }
        throw error;
      }
      return jsonResult({ path: filePath, size });
    }
  );
}
