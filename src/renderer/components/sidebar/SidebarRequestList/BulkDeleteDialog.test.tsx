import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BulkDeleteDialog } from './BulkDeleteDialog';

describe('BulkDeleteDialog', () => {
  const onOpenChangeMock = vi.fn();
  const onConfirmMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when closed', () => {
    render(
      <BulkDeleteDialog
        open={false}
        count={2}
        onOpenChange={onOpenChangeMock}
        onConfirm={onConfirmMock}
      />
    );

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows the singular item count in the title when open', () => {
    render(
      <BulkDeleteDialog
        open={true}
        count={1}
        onOpenChange={onOpenChangeMock}
        onConfirm={onConfirmMock}
      />
    );

    expect(screen.getByText('Delete 1 item?')).toBeDefined();
  });

  it('shows the plural item count in the title when open', () => {
    render(
      <BulkDeleteDialog
        open={true}
        count={4}
        onOpenChange={onOpenChangeMock}
        onConfirm={onConfirmMock}
      />
    );

    expect(screen.getByText('Delete 4 items?')).toBeDefined();
  });

  it('calls onConfirm when Delete is clicked', async () => {
    const user = userEvent.setup();
    render(
      <BulkDeleteDialog
        open={true}
        count={2}
        onOpenChange={onOpenChangeMock}
        onConfirm={onConfirmMock}
      />
    );

    await user.click(screen.getByRole('button', { name: /^delete$/i }));

    expect(onConfirmMock).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenChange(false) when Cancel is clicked', async () => {
    const user = userEvent.setup();
    render(
      <BulkDeleteDialog
        open={true}
        count={2}
        onOpenChange={onOpenChangeMock}
        onConfirm={onConfirmMock}
      />
    );

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onOpenChangeMock).toHaveBeenCalledWith(false);
    expect(onConfirmMock).not.toHaveBeenCalled();
  });
});
