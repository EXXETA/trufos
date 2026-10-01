import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
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

  it('should not show toggle but still mask when secret is true and value is empty', () => {
    // Arrange
    const { container, queryByText } = render(
      <SecretInput secret={true} value="" onChange={vi.fn()} />
    );

    // Assert
    expect(queryByText('Show')).toBeNull();
    expect(queryByText('Hide')).toBeNull();
    expect((container.querySelector('input') as HTMLInputElement).type).toBe('password');
  });

  it('should show toggle when typing a value into an empty secret input', async () => {
    // Arrange
    const user = userEvent.setup();
    const Wrapper = () => {
      const [value, setValue] = useState('');
      return <SecretInput secret={true} value={value} onChange={(e) => setValue(e.target.value)} />;
    };
    const { container, queryByText } = render(<Wrapper />);
    expect(queryByText('Show')).toBeNull();

    // Act
    await user.type(container.querySelector('input') as HTMLInputElement, 'abc');

    // Assert
    expect(queryByText('Show')).not.toBeNull();
  });

  it('should show toggle when rerendered with a value', () => {
    // Arrange
    const { rerender, queryByText } = render(
      <SecretInput secret={true} value="" onChange={vi.fn()} />
    );
    expect(queryByText('Show')).toBeNull();

    // Act
    rerender(<SecretInput secret={true} value="x" onChange={vi.fn()} />);

    // Assert
    expect(queryByText('Show')).not.toBeNull();
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
