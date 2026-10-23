import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '../fixtures/trufos-app';
import { clickMenuItem } from '../helpers/main-process';
import { sidebarItem } from '../helpers/ui';

/**
 * Renames a request of the default collection in its info file, as git or an editor would.
 * @param userDataDir the `userData` directory of the app
 * @param from the current title of the request
 * @param to the new title
 */
async function renameRequestOnDisk(userDataDir: string, from: string, to: string): Promise<void> {
  const collectionDir = path.join(userDataDir, 'default-collection');
  const entries = await readdir(collectionDir, { recursive: true });
  for (const entry of entries) {
    if (path.basename(entry) !== 'request.json') continue;
    const filePath = path.join(collectionDir, entry);
    const info = JSON.parse(await readFile(filePath, 'utf-8'));
    if (info.title !== from) continue;
    await writeFile(filePath, JSON.stringify({ ...info, title: to }));
    return;
  }
  throw new Error(`No request titled "${from}" in ${collectionDir}`);
}

test.describe('changes outside the app', () => {
  test('reloads the collection when the window gets focus again', async ({
    trufos,
    userDataDir,
  }) => {
    await expect(sidebarItem(trufos.window, 'Example Request')).toBeVisible();

    await renameRequestOnDisk(userDataDir, 'Example Request', 'Renamed Outside');
    // A headless window cannot reliably lose and regain the OS focus, so the event the app
    // listens to is dispatched in the renderer instead. The e2e project has no DOM types, hence
    // the expression as a string.
    await trufos.window.evaluate("window.dispatchEvent(new Event('focus'))");

    await expect(sidebarItem(trufos.window, 'Renamed Outside')).toBeVisible();
  });

  test('reloads the collection from the Collection menu', async ({ trufos, userDataDir }) => {
    await expect(sidebarItem(trufos.window, 'Example Request')).toBeVisible();

    await renameRequestOnDisk(userDataDir, 'Example Request', 'Renamed Outside');
    await clickMenuItem(trufos.app, 'Reload from Disk');

    await expect(sidebarItem(trufos.window, 'Renamed Outside')).toBeVisible();
  });
});
