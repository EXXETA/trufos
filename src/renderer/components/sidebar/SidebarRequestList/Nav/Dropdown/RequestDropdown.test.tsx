import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { makeRequest } from 'shim/__mocks__/collection-fixtures';
import { toast } from '@/components/ui/sonner';
import { RequestDropdown } from './RequestDropdown';

const copyRequestAsCurlMock = vi.fn<(id: string) => Promise<boolean>>();

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

  async function clickCopyAsCurl() {
    const user = userEvent.setup();
    render(<RequestDropdown request={request} onRename={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'More' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Copy as cURL' }));
  }

  it('copies the request as cURL and confirms it', async () => {
    copyRequestAsCurlMock.mockResolvedValue(true);

    await clickCopyAsCurl();

    expect(copyRequestAsCurlMock).toHaveBeenCalledWith('r1');
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('cURL command copied'));
  });

  it('does not confirm if copying failed', async () => {
    copyRequestAsCurlMock.mockResolvedValue(false);

    await clickCopyAsCurl();

    expect(copyRequestAsCurlMock).toHaveBeenCalledWith('r1');
    expect(toast.success).not.toHaveBeenCalled();
  });
});
