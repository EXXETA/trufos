import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '../fixtures/trufos-app';
import { stubDirectoryPicker } from '../helpers/main-process';
import { sidebarItem } from '../helpers/ui';

const POSTMAN_COLLECTION = path.resolve(
  __dirname,
  '..',
  'fixtures',
  'data',
  'postman-collection.json'
);

test('imports a Postman collection and opens it', async ({ trufos }, testInfo) => {
  const { app, window } = trufos;

  const targetDir = testInfo.outputPath('imported-collection');
  await mkdir(targetDir, { recursive: true });
  await stubDirectoryPicker(app, targetDir);

  await window.getByRole('button', { name: 'Default Collection' }).click();
  await window.getByRole('menuitem', { name: 'Import Collection' }).click();

  const dialog = window.getByRole('dialog');
  await dialog.getByRole('tab', { name: 'Postman' }).click();

  // The source picker delegates to a hidden file input, the target picker to a native directory
  // dialog that `stubDirectoryPicker` already answered.
  await dialog.locator('input[type="file"]').setInputFiles(POSTMAN_COLLECTION);
  await dialog.getByRole('button', { name: /Select directory for new collection/ }).click();
  await dialog.getByPlaceholder('Name of the new collection').fill('Imported Collection');

  await dialog.getByRole('button', { name: 'Complete Import' }).click();

  await expect(window.getByRole('button', { name: 'Imported Collection' })).toBeVisible();
  await expect(sidebarItem(window, 'Imported Request')).toBeVisible();
  await expect(window.getByText('Imported Folder')).toBeVisible();
});
