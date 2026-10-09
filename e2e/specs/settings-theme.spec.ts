import { expect, test } from '../fixtures/trufos-app';
import { openAppSettings } from '../helpers/main-process';

test('switches the theme and keeps the choice across restarts', async ({
  trufos,
  launchTrufos,
}) => {
  const { window } = trufos;
  const root = window.locator('html');

  await openAppSettings(trufos.app);
  const dialog = window.getByRole('dialog');
  await expect(dialog.getByText('Settings')).toBeVisible();

  await dialog.getByRole('button', { name: 'Dark', exact: true }).click();
  await expect(root).toHaveClass(/\bdark\b/);

  await dialog.getByRole('button', { name: 'Light', exact: true }).click();
  await expect(root).toHaveClass(/\blight\b/);

  await dialog.getByRole('button', { name: 'Dark', exact: true }).click();
  await expect(root).toHaveClass(/\bdark\b/);

  await window.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await trufos.close();

  const relaunched = await launchTrufos();
  await expect(relaunched.window.locator('html')).toHaveClass(/\bdark\b/);
});
