import { expect, test } from '../fixtures/trufos-app';
import {
  createRequest,
  selectRequest,
  sidebarItem,
  setUrl,
  urlEditor,
  urlText,
} from '../helpers/ui';

test.describe('persistence across restarts', () => {
  test('restores a saved request', async ({ trufos, launchTrufos, echoServer }) => {
    const url = echoServer.url('/json');

    await createRequest(trufos.window, 'Persisted Request');
    await setUrl(trufos.window, url);
    await trufos.window.getByRole('button', { name: 'Save request' }).click();

    // The save button is only enabled while the request has unsaved changes.
    await expect(trufos.window.getByRole('button', { name: 'Save request' })).toBeDisabled();

    await trufos.close();

    const relaunched = await launchTrufos();
    await expect(sidebarItem(relaunched.window, 'Persisted Request')).toBeVisible();

    await selectRequest(relaunched.window, 'Persisted Request');
    await expect(urlText(relaunched.window)).toContainText(url);
  });

  test('restores the selected collection view after a restart', async ({
    trufos,
    launchTrufos,
  }) => {
    await expect(trufos.window.getByRole('button', { name: 'Default Collection' })).toBeVisible();
    await trufos.close();

    const relaunched = await launchTrufos();
    await expect(
      relaunched.window.getByRole('button', { name: 'Default Collection' })
    ).toBeVisible();
    await expect(sidebarItem(relaunched.window, 'Example Request')).toBeVisible();
    await expect(urlEditor(relaunched.window)).toBeHidden();
  });
});
