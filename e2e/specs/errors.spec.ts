import { expect, test } from '../fixtures/trufos-app';
import { responseStatus, selectRequest, sendRequest, setUrl, toasts } from '../helpers/ui';

test.describe('error states', () => {
  test('explains an unreachable server and stays usable', async ({ trufos, echoServer }) => {
    const { window } = trufos;

    await selectRequest(window, 'Example Request');
    await setUrl(window, echoServer.unreachableUrl);
    await sendRequest(window);

    await expect(toasts(window).first()).toContainText('The connection was refused');

    // The app must recover from the failed send rather than get stuck in the sending state.
    await setUrl(window, echoServer.url('/json'));
    await sendRequest(window);
    await expect(responseStatus(window)).toContainText('200 OK');
  });

  test('explains a host that cannot be resolved', async ({ trufos }) => {
    const { window } = trufos;

    await selectRequest(window, 'Example Request');
    await setUrl(window, 'http://this-host-does-not-exist.invalid/');
    await sendRequest(window);

    await expect(toasts(window).first()).toContainText('The host could not be resolved');
  });
});
