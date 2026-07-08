import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { RequestDropdown } from './RequestDropdown';
import { RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { RequestMethod } from 'shim/objects/request-method';

const openMock = vi.fn();
const toastSuccessMock = vi.fn();
const showErrorMock = vi.fn();
const writeTextMock = vi.fn();

vi.mock('@/lib/ipc-stream', () => ({
  IpcPushStream: { open: (...args: unknown[]) => openMock(...args) },
}));

vi.mock('@/components/ui/sonner', () => ({
  toast: { success: (...args: unknown[]) => toastSuccessMock(...args) },
}));

vi.mock('@/error/errorHandler', () => ({
  showError: (...args: unknown[]) => showErrorMock(...args),
}));

vi.mock('@/state/collectionStore', () => ({
  useCollectionStore: <T,>(selector: (state: { selectedRequestId: string }) => T) =>
    selector({ selectedRequestId: 'other' }),
  useCollectionActions: () => ({ copyRequest: vi.fn(), deleteRequest: vi.fn() }),
}));

function makeRequest(overrides: Partial<TrufosRequest> = {}): TrufosRequest {
  return {
    id: 'req-1',
    parentId: 'col-1',
    type: 'request',
    lastModified: 0,
    title: 'Login',
    url: { base: 'https://example.com/login', query: [] },
    method: RequestMethod.POST,
    headers: [{ key: 'Accept', value: 'application/json', isActive: true }],
    body: { type: RequestBodyType.TEXT, mimeType: 'application/json' },
    ...overrides,
  } as TrufosRequest;
}

async function clickCopyAsCurl(request: TrufosRequest) {
  const user = userEvent.setup();
  // userEvent.setup() installs its own clipboard stub, so ours must come after it.
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: (text: string) => writeTextMock(text) },
    configurable: true,
  });
  render(<RequestDropdown request={request} onRename={vi.fn()} />);

  await user.click(screen.getByRole('button', { name: /more/i }));
  await user.click(await screen.findByText('Copy as cURL'));
}

beforeEach(() => {
  vi.clearAllMocks();
  writeTextMock.mockResolvedValue(undefined);
});

describe('RequestDropdown copy as cURL', () => {
  it('copies the command with the body read from the body file', async () => {
    openMock.mockResolvedValue({ readAll: () => Promise.resolve('{"user":"trufos"}') });

    await clickCopyAsCurl(makeRequest());

    await waitFor(() => expect(writeTextMock).toHaveBeenCalledTimes(1));
    const command = writeTextMock.mock.calls[0][0] as string;
    expect(command).toContain("curl -X POST 'https://example.com/login'");
    expect(command).toContain("-H 'Accept: application/json'");
    expect(command).toContain(`--data-raw '{"user":"trufos"}'`);
    expect(toastSuccessMock).toHaveBeenCalled();
    expect(showErrorMock).not.toHaveBeenCalled();
  });

  it('copies without a body when the body file does not exist', async () => {
    openMock.mockRejectedValue(new Error('file not found'));

    await clickCopyAsCurl(makeRequest());

    await waitFor(() => expect(writeTextMock).toHaveBeenCalledTimes(1));
    const command = writeTextMock.mock.calls[0][0] as string;
    expect(command).toContain('curl -X POST');
    expect(command).not.toContain('--data-raw');
    expect(toastSuccessMock).toHaveBeenCalled();
  });

  it('shows an error when writing to the clipboard fails', async () => {
    openMock.mockResolvedValue({ readAll: () => Promise.resolve('') });
    writeTextMock.mockRejectedValue(new Error('denied'));

    await clickCopyAsCurl(makeRequest());

    await waitFor(() => expect(showErrorMock).toHaveBeenCalled());
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });
});
