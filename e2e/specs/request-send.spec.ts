import { expect, test } from '../fixtures/trufos-app';
import {
  createRequest,
  responseStatus,
  responseTab,
  selectRequest,
  sendRequest,
  setUrl,
} from '../helpers/ui';

test.describe('sending requests', () => {
  test('sends an existing request and renders the response', async ({ trufos, echoServer }) => {
    const { window } = trufos;

    await selectRequest(window, 'Example Request');
    await setUrl(window, echoServer.url('/json'));
    await sendRequest(window);

    await expect(responseStatus(window)).toContainText('200 OK');
    await expect(responseTab(window, 'Response Body')).toBeVisible();

    await responseTab(window, 'Headers').click();
    await expect(window.getByRole('cell', { name: 'content-type' })).toBeVisible();
    await expect(window.getByRole('cell', { name: 'application/json' })).toBeVisible();

    // A non-success status is reported as such instead of being swallowed.
    await setUrl(window, echoServer.url('/status/500'));
    await sendRequest(window);
    await expect(responseStatus(window)).toContainText('500');
  });

  test('sends a newly created request', async ({ trufos, echoServer }) => {
    const { window } = trufos;

    await createRequest(window, 'Created Request');
    await setUrl(window, echoServer.url('/text'));
    await sendRequest(window);

    await expect(responseStatus(window)).toContainText('200 OK');
  });
});
