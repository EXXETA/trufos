import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BulkActionBar } from './BulkActionBar';

describe('BulkActionBar', () => {
  const onClearMock = vi.fn();
  const onDuplicateMock = vi.fn();
  const onDeleteClickMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when count is 0', () => {
    const { container } = render(
      <BulkActionBar
        count={0}
        onClear={onClearMock}
        onDuplicate={onDuplicateMock}
        onDeleteClick={onDeleteClickMock}
      />
    );

    expect(container.innerHTML).toBe('');
  });

  it('shows the singular item count and label', () => {
    render(
      <BulkActionBar
        count={1}
        onClear={onClearMock}
        onDuplicate={onDuplicateMock}
        onDeleteClick={onDeleteClickMock}
      />
    );

    expect(screen.getByText('1 item selected')).toBeDefined();
  });

  it('shows the plural item count and label', () => {
    render(
      <BulkActionBar
        count={3}
        onClear={onClearMock}
        onDuplicate={onDuplicateMock}
        onDeleteClick={onDeleteClickMock}
      />
    );

    expect(screen.getByText('3 items selected')).toBeDefined();
  });

  it('calls onClear when Clear is clicked', async () => {
    const user = userEvent.setup();
    render(
      <BulkActionBar
        count={2}
        onClear={onClearMock}
        onDuplicate={onDuplicateMock}
        onDeleteClick={onDeleteClickMock}
      />
    );

    await user.click(screen.getByRole('button', { name: /clear/i }));

    expect(onClearMock).toHaveBeenCalledTimes(1);
  });

  it('calls onDuplicate when Duplicate is clicked', async () => {
    const user = userEvent.setup();
    render(
      <BulkActionBar
        count={2}
        onClear={onClearMock}
        onDuplicate={onDuplicateMock}
        onDeleteClick={onDeleteClickMock}
      />
    );

    await user.click(screen.getByRole('button', { name: /duplicate/i }));

    expect(onDuplicateMock).toHaveBeenCalledTimes(1);
  });

  it('calls onDeleteClick when Delete is clicked', async () => {
    const user = userEvent.setup();
    render(
      <BulkActionBar
        count={2}
        onClear={onClearMock}
        onDuplicate={onDuplicateMock}
        onDeleteClick={onDeleteClickMock}
      />
    );

    await user.click(screen.getByRole('button', { name: /delete/i }));

    expect(onDeleteClickMock).toHaveBeenCalledTimes(1);
  });
});
