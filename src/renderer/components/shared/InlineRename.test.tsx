import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { InlineRename } from './InlineRename';

describe('InlineRename', () => {
  const onSaveMock = vi.fn();
  const onCancelMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with initial value', () => {
    render(<InlineRename initialValue="test-value" onSave={onSaveMock} onCancel={onCancelMock} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('test-value');
  });

  it('updates value when typing', async () => {
    const user = userEvent.setup();
    render(<InlineRename initialValue="" onSave={onSaveMock} onCancel={onCancelMock} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;

    await user.type(input, 'new name');
    expect(input.value).toBe('new name');
  });

  it('calls onSave when save button is clicked', async () => {
    const user = userEvent.setup();
    render(<InlineRename initialValue="initial" onSave={onSaveMock} onCancel={onCancelMock} />);

    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'saved name');

    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);

    expect(onSaveMock).toHaveBeenCalledWith('saved name');
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<InlineRename initialValue="initial" onSave={onSaveMock} onCancel={onCancelMock} />);

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(onCancelMock).toHaveBeenCalledOnce();
  });

  it('calls onSave when Enter is pressed', async () => {
    const user = userEvent.setup();
    render(<InlineRename initialValue="enter-test" onSave={onSaveMock} onCancel={onCancelMock} />);

    const input = screen.getByRole('textbox');
    await user.type(input, '{Enter}');

    expect(onSaveMock).toHaveBeenCalledWith('enter-test');
  });

  it('calls onCancel when Escape is pressed', async () => {
    const user = userEvent.setup();
    render(<InlineRename initialValue="escape-test" onSave={onSaveMock} onCancel={onCancelMock} />);

    const input = screen.getByRole('textbox');
    await user.type(input, '{Escape}');

    expect(onCancelMock).toHaveBeenCalledOnce();
  });

  it('respects validate function and disables save button', async () => {
    const user = userEvent.setup();
    const validate = (val: string) => val.length > 3;

    render(
      <InlineRename
        initialValue="12"
        validate={validate}
        onSave={onSaveMock}
        onCancel={onCancelMock}
      />
    );

    const input = screen.getByRole('textbox') as HTMLInputElement;
    const saveButton = screen.getByRole('button', { name: /save/i }) as HTMLButtonElement;

    expect(saveButton.disabled).toBe(true);

    await user.type(input, '34'); // '1234'
    expect(saveButton.disabled).toBe(false);
  });

  it('does not call onSave if validation fails on Enter', async () => {
    const user = userEvent.setup();
    const validate = (val: string) => val.length > 3;

    render(
      <InlineRename
        initialValue="12"
        validate={validate}
        onSave={onSaveMock}
        onCancel={onCancelMock}
      />
    );

    const input = screen.getByRole('textbox');
    await user.type(input, '{Enter}');

    expect(onSaveMock).not.toHaveBeenCalled();
  });
});
