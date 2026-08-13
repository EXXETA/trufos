import { describe, expect, it, vi } from 'vitest';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { TEXT_BODY_FILE_NAME } from 'shim/objects/request';

const DEEP_PATH = '/api/v2/organizations/{orgId}/projects/{projectId}/deployments/{deploymentId}';

const SPEC = {
  openapi: '3.0.3',
  info: { title: 'Relution' },
  servers: [{ url: 'https://example.com/api/v1' }],
  paths: {
    '/apps': {
      post: {
        tags: ['Apps'],
        summary: `Takes native app file from request and creates new appstore application.
          Optional parameters for the request are:
          - changelog: to provide a changelog in form of a text file
          - releaseState: the release state the app should be in after creation (DEVELOPMENT, REVIEW, RELEASE)`,
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { name: { type: 'string' }, size: { type: 'integer' } },
              },
            },
          },
        },
        responses: {},
      },
      get: { tags: ['Apps'], summary: 'Takes native app file from request', responses: {} },
    },
    // same summary as the operation above, so their directory names collide
    '/apps/bulk': {
      post: { tags: ['Apps'], summary: 'Takes native app file from request', responses: {} },
    },
    // no summary and no operation ID, so the title and directory name come from the path
    [`${DEEP_PATH}/logs`]: { get: { tags: ['Apps'], responses: {} } },
    '/health': { get: { responses: {} } },
  },
};

/** Lists the sorted names of all subdirectories of the given directory. */
async function readDirNames(dirPath: string) {
  const fs = await import('node:fs/promises');
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  return entries.flatMap((entry) => (entry.isDirectory() ? entry.name : [])).sort();
}

describe('OpenAPI import', () => {
  it('creates directories that the file system accepts for the whole document', async () => {
    // Arrange: the OpenAPI parser reads the source file with the real file system, because it is
    // not part of the module graph that vitest mocks. Everything the import writes stays in memfs.
    const realFs = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
    const srcFilePath = path.join(tmpdir(), `openapi-e2e-${process.pid}.json`);
    await realFs.writeFile(srcFilePath, JSON.stringify(SPEC));
    const targetDirPath = path.join(tmpdir(), 'collections');
    // the target directory already holds a collection, so the import creates its own one inside it
    const fs = await import('node:fs/promises');
    await fs.mkdir(path.join(targetDirPath, 'other-collection'), { recursive: true });

    try {
      // Act
      const { ImportService } = await import('./import-service.js');
      const { collection } = await ImportService.instance.importCollection(
        srcFilePath,
        targetDirPath,
        'OpenAPI'
      );

      // Assert
      expect(collection.dirPath).toBe(path.join(targetDirPath, 'relution'));
      expect(await readDirNames(collection.dirPath)).toEqual(['apps', 'health']);

      const requestDirNames = await readDirNames(path.join(collection.dirPath, 'apps'));
      expect(requestDirNames).toEqual([
        'api-v2-organizations-org-id-projects-project-id-deployments',
        'takes-native-app-file-from-request',
        'takes-native-app-file-from-request-2', // duplicate summary suffixed
        'takes-native-app-file-from-request-and-creates-new-appstore',
      ]);
      // memfs does not enforce name limits, so assert the limit of real file systems explicitly.
      // 255 bytes is the maximum file name length of ext4, APFS, HFS+ and NTFS.
      for (const dirName of requestDirNames) {
        expect(Buffer.byteLength(dirName)).toBeLessThanOrEqual(255);
      }

      // the body a request was imported with must end up in its body file, because that is the
      // only place the editor and the sending of a request read it from
      const fs = await import('node:fs/promises');
      const bodyFilePath = path.join(
        collection.dirPath,
        'apps',
        'takes-native-app-file-from-request-and-creates-new-appstore',
        TEXT_BODY_FILE_NAME
      );
      expect(await fs.readFile(bodyFilePath, 'utf-8')).toBe(
        JSON.stringify({ name: '', size: 0 }, null, 2)
      );
    } finally {
      await realFs.rm(srcFilePath, { force: true });
    }
  });
});
