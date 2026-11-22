import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { makeRequest } from 'shim/__mocks__/collection-fixtures';
import { toast } from '@/components/ui/sonner';
import { RequestDropdown } from './RequestDropdown';
import type { CurlOptions } from 'shim/event-service';

const copyRequestAsCurlMock = vi.fn<(id: string, options?: CurlOptions) => Promise<boolean>>();

vi.mock('@/state/collectionStore', () => ({
  useCollectionActions: () => ({
    copyItem: vi.fn(),
    copyRequestAsCurl: copyRequestAsCurlMock,
    deleteItem: vi.fn(),
  }),
  useCollectionStore: () => undefined,
}));

vi.mock('@/components/ui/sonner', () => ({
  toast: { success: vi.fn() },
}));

describe('RequestDropdown', () => {
  const request = makeRequest('r1', 'col');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function clickMenuItem(name: string) {
    const user = userEvent.setup();
    render(<RequestDropdown request={request} onRename={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'More' }));
    await user.click(await screen.findByRole('menuitem', { name }));
  }

  it('copies the request as cURL and confirms it', async () => {
    copyRequestAsCurlMock.mockResolvedValue(true);

    await clickMenuItem('Copy as cURL');

    expect(copyRequestAsCurlMock).toHaveBeenCalledWith('r1', {});
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('cURL command copied'));
  });

  it('copies the request as cURL with secrets and says so', async () => {
    copyRequestAsCurlMock.mockResolvedValue(true);

    await clickMenuItem('Copy as cURL with Secrets');

    expect(copyRequestAsCurlMock).toHaveBeenCalledWith('r1', { includeSecrets: true });
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('cURL command with secrets copied')
    );
  });

  it('does not confirm if copying failed', async () => {
    copyRequestAsCurlMock.mockResolvedValue(false);

    await clickMenuItem('Copy as cURL');

    expect(copyRequestAsCurlMock).toHaveBeenCalledWith('r1', {});
    expect(toast.success).not.toHaveBeenCalled();
  });
});
