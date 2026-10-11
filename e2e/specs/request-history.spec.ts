import { expect, test } from '../fixtures/trufos-app';
import { openAppSettings } from '../helpers/main-process';
import { responseStatus, selectRequest, sendRequest, setUrl } from '../helpers/ui';

test('shows a sent request with its response in the history', async ({ trufos, echoServer }) => {
  const { window } = trufos;
  const url = echoServer.url('/json');

  await selectRequest(window, 'Example Request');
  await setUrl(window, url);
  await sendRequest(window);
  await expect(responseStatus(window)).toContainText('200 OK');

  await openAppSettings(trufos.app);
  const dialog = window.getByRole('dialog');
  await dialog.getByRole('tab', { name: 'History' }).click();

  const entry = dialog.getByRole('list', { name: 'Request history' }).getByRole('button');
  await expect(entry).toHaveCount(1);
  await expect(entry).toContainText('Example Request');
  await expect(entry).toContainText('200');

  await entry.click();
  const details = dialog.getByRole('region', { name: 'Request details' });
  await expect(details.getByText(url, { exact: true })).toBeVisible();
  await expect(details.getByRole('table', { name: 'Headers' })).toContainText('user-agent');

  await details.getByRole('tab', { name: 'Response' }).click();
  await expect(details.getByRole('table', { name: 'Headers' })).toContainText('content-type');
});
