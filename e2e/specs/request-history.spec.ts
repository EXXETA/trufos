import { expect, test } from '../fixtures/trufos-app';
import { clickMenuItem } from '../helpers/main-process';
import { responseStatus, selectRequest, sendRequest, setUrl } from '../helpers/ui';

test('shows a sent request with its response in the history', async ({ trufos, echoServer }) => {
  const { window } = trufos;
  const url = echoServer.url('/json?role=admin');

  await selectRequest(window, 'Example Request');
  await setUrl(window, url);
  await sendRequest(window);
  await expect(responseStatus(window)).toContainText('200 OK');

  await window.getByRole('button', { name: 'Request history' }).click();
  const entry = window.getByRole('list', { name: 'Request history' }).getByRole('button');
  await expect(entry).toHaveCount(1);
  await expect(entry).toContainText('Example Request');
  await expect(entry).toContainText('200');

  await entry.click();
  const details = window.getByRole('region', { name: 'History entry' });
  await expect(details.getByLabel('URL')).toHaveText(url);
  await expect(details.locator('.response-status')).toContainText('200 OK');

  await details.getByRole('tab', { name: /^Parameters/ }).click();
  await expect(details.getByRole('table', { name: 'Query parameters' })).toContainText('admin');
  await details.getByRole('tab', { name: /^Headers \(/ }).click();
  await expect(details.getByRole('table', { name: 'Request headers' })).toContainText('user-agent');
  await details.getByRole('tab', { name: 'Headers', exact: true }).click();
  await expect(details.getByRole('table', { name: 'Response headers' })).toContainText(
    'content-type'
  );

  await details.getByRole('button', { name: 'Go to request' }).click();
  await expect(details).toBeHidden();
  await expect(window.getByRole('list', { name: 'Request history' })).toBeHidden();
});

test('opens the history from the Collection menu', async ({ trufos }) => {
  const { window } = trufos;

  await clickMenuItem(trufos.app, 'History');

  await expect(window.getByRole('button', { name: 'Request history' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await expect(window.getByText('No requests sent yet.')).toBeVisible();
});
