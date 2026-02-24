import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect } from 'vitest';
import { SecretInput } from './secret-input';

describe('SecretInput', () => {
  it('should display value as visible text when secret is false', () => {
    // Arrange
    const { getByDisplayValue, queryByText } = render(
      <SecretInput secret={false} value="my-value" onChange={vi.fn()} />
    );

    // Assert
    const input = getByDisplayValue('my-value') as HTMLInputElement;
    expect(input.type).toBe('text');
    expect(queryByText('Show')).toBeNull();
    expect(queryByText('Hide')).toBeNull();
  });

  it('should display value as password when secret is true', () => {
    // Arrange
    const { getByDisplayValue, getByText } = render(
      <SecretInput secret={true} value="secret-value" onChange={vi.fn()} />
    );

    // Assert
    const input = getByDisplayValue('secret-value') as HTMLInputElement;
    expect(input.type).toBe('password');
    expect(getByText('Show')).toBeDefined();
  });

  it('should toggle between password and text when Show/Hide is clicked', async () => {
    // Arrange
    const user = userEvent.setup();
    const { getByDisplayValue, getByText } = render(
      <SecretInput secret={true} value="secret-value" onChange={vi.fn()} />
    );

    // Assert - Initially hidden
    const input = getByDisplayValue('secret-value') as HTMLInputElement;
    expect(input.type).toBe('password');

    // Act - Click Show
    await user.click(getByText('Show'));

    // Assert - Now visible
    expect(input.type).toBe('text');
    expect(getByText('Hide')).toBeDefined();

    // Act - Click Hide
    await user.click(getByText('Hide'));

    // Assert - Hidden again
    expect(input.type).toBe('password');
    expect(getByText('Show')).toBeDefined();
  });

  it('should call onChange when value changes', async () => {
    // Arrange
    const user = userEvent.setup();
    const onChangeMock = vi.fn();
    const { getByDisplayValue } = render(
      <SecretInput secret={false} value="initial" onChange={onChangeMock} />
    );

    // Act
    const input = getByDisplayValue('initial');
    await user.clear(input);
    await user.type(input, 'new-value');

    // Assert
    expect(onChangeMock).toHaveBeenCalled();
  });

  it('should not show Show/Hide button when secret changes from true to false', () => {
    // Arrange
    const { rerender, queryByText, getByDisplayValue } = render(
      <SecretInput secret={true} value="test" onChange={vi.fn()} />
    );

    // Assert - Show button exists
    expect(queryByText('Show')).toBeDefined();

    // Act - Change secret to false
    rerender(<SecretInput secret={false} value="test" onChange={vi.fn()} />);

    // Assert - Show/Hide buttons are gone, input is text
    expect(queryByText('Show')).toBeNull();
    expect(queryByText('Hide')).toBeNull();
    const input = getByDisplayValue('test') as HTMLInputElement;
    expect(input.type).toBe('text');
  });
});
