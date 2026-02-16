import { render, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, afterEach } from 'vitest';
import { SimpleSelect } from './SimpleSelect';

describe('SimpleSelect', () => {
  afterEach(() => {
    cleanup();
  });

  it('should display the selected value', () => {
    // Arrange
    const items: [string, string][] = [
      ['json', 'JSON'],
      ['xml', 'XML'],
      ['text', 'Plain Text'],
    ];
    const onValueChangeMock = vi.fn();

    const { getByText } = render(
      <SimpleSelect value="json" onValueChange={onValueChangeMock} items={items} />
    );

    // Assert
    expect(getByText('JSON')).toBeDefined();
  });

  it('should display placeholder when no value is selected', () => {
    // Arrange
    const items: [string, string][] = [
      ['option1', 'Option 1'],
      ['option2', 'Option 2'],
    ];
    const onValueChangeMock = vi.fn();

    const { getByText } = render(
      <SimpleSelect
        value=""
        onValueChange={onValueChangeMock}
        items={items}
        placeholder="Select an option"
      />
    );

    // Assert
    expect(getByText('Select an option')).toBeDefined();
  });

  it('should call onValueChange when selecting a different value', async () => {
    // Arrange
    const user = userEvent.setup();
    const items: [string, string][] = [
      ['small', 'Small'],
      ['medium', 'Medium'],
      ['large', 'Large'],
    ];
    const onValueChangeMock = vi.fn();

    const { getByRole, findByText } = render(
      <SimpleSelect value="small" onValueChange={onValueChangeMock} items={items} />
    );

    // Act
    await user.click(getByRole('combobox'));
    const largeOption = await findByText('Large');
    await user.click(largeOption);

    // Assert
    expect(onValueChangeMock).toHaveBeenCalledTimes(1);
    expect(onValueChangeMock).toHaveBeenCalledWith('large');
  });

  it('should render all items in the dropdown', async () => {
    // Arrange
    const user = userEvent.setup();
    const items: [string, string][] = [
      ['red', 'Red'],
      ['green', 'Green'],
      ['blue', 'Blue'],
    ];
    const onValueChangeMock = vi.fn();

    const { getByRole, findAllByText, findByText } = render(
      <SimpleSelect value="red" onValueChange={onValueChangeMock} items={items} />
    );

    // Act
    await user.click(getByRole('combobox'));

    // Assert - Red appears twice (trigger + dropdown), others once
    const redElements = await findAllByText('Red');
    expect(redElements.length).toBeGreaterThanOrEqual(1);
    expect(await findByText('Green')).toBeDefined();
    expect(await findByText('Blue')).toBeDefined();
  });

  it('should work with single character values', async () => {
    // Arrange
    const user = userEvent.setup();
    const items: [string, string][] = [
      ['a', 'Option A'],
      ['b', 'Option B'],
      ['c', 'Option C'],
    ];
    const onValueChangeMock = vi.fn();

    const { getByRole, findByText } = render(
      <SimpleSelect value="a" onValueChange={onValueChangeMock} items={items} />
    );

    // Act
    await user.click(getByRole('combobox'));
    const optionB = await findByText('Option B');
    await user.click(optionB);

    // Assert
    expect(onValueChangeMock).toHaveBeenCalledWith('b');
  });

  it('should handle items with special characters in labels', () => {
    // Arrange
    const items: [string, string][] = [
      ['utf8', 'UTF-8 Encoding'],
      ['iso', 'ISO-8859-1'],
      ['ascii', 'ASCII (7-bit)'],
    ];
    const onValueChangeMock = vi.fn();

    const { getByText } = render(
      <SimpleSelect value="utf8" onValueChange={onValueChangeMock} items={items} />
    );

    // Assert
    expect(getByText('UTF-8 Encoding')).toBeDefined();
  });
});
