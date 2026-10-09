import { expect, test } from '../fixtures/trufos-app';
import { sidebarItem, toasts, urlEditor } from '../helpers/ui';

test('starts up with the default collection and no request selected', async ({ trufos }) => {
  const { app, window } = trufos;

  // Asked in the main process: the window is created hidden and only shown once the renderer
  // reports itself ready, so its visibility is what proves startup ran to completion.
  const isVisible = await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]?.isVisible()
  );
  expect(isVisible).toBe(true);

  await expect(window.getByRole('button', { name: 'Default Collection' })).toBeVisible();
  await expect(sidebarItem(window, 'Example Request')).toBeVisible();
  await expect(window.getByText('Example Folder')).toBeVisible();

  await expect(window.getByText('or select a request to get started')).toBeVisible();
  await expect(urlEditor(window)).toBeHidden();
  await expect(toasts(window)).toHaveCount(0);
});
