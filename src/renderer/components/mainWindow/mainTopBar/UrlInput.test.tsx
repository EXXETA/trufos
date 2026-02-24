import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect } from 'vitest';
import { UrlInput } from './UrlInput';
import { parseUrl } from 'shim/objects/url';

describe('UrlInput', () => {
  it('should display the initial URL', () => {
    // Arrange
    const url = parseUrl('https://example.com');
    const onChangeMock = vi.fn();
    const { getByDisplayValue } = render(<UrlInput url={url} onChange={onChangeMock} />);

    // Assert
    expect(getByDisplayValue('https://example.com')).toBeDefined();
  });

  it('should call onChange when URL is modified', async () => {
    // Arrange
    const user = userEvent.setup();
    const url = parseUrl('https://example.com');
    const onChangeMock = vi.fn();
    const { getByRole } = render(<UrlInput url={url} onChange={onChangeMock} />);

    // Act
    const input = getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'https://newurl.com');

    // Assert
    expect(onChangeMock).toHaveBeenCalled();
    expect(onChangeMock).toHaveBeenCalledWith(parseUrl('https://newurl.com'));
  });

  it('should show error style for invalid URL', async () => {
    // Arrange
    const user = userEvent.setup();
    const url = parseUrl('https://example.com');
    const onChangeMock = vi.fn();
    const { getByRole } = render(<UrlInput url={url} onChange={onChangeMock} />);

    // Act
    const input = getByRole('textbox') as HTMLInputElement;
    await user.clear(input);
    await user.type(input, 'not-a-valid-url');

    // Assert
    expect(input.className).toContain('border-(--error)');
  });

  it('should handle URLs with query parameters', async () => {
    // Arrange
    const user = userEvent.setup();
    const url = parseUrl('https://api.example.com/users');
    const onChangeMock = vi.fn();
    const { getByRole } = render(<UrlInput url={url} onChange={onChangeMock} />);

    // Act
    const input = getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'https://api.example.com/users?id=123&name=test');

    // Assert
    expect(onChangeMock).toHaveBeenCalled();
    const lastCall = onChangeMock.mock.calls[onChangeMock.mock.calls.length - 1][0];
    expect(lastCall.base).toBe('https://api.example.com/users');
    expect(lastCall.query).toHaveLength(2);
    expect(lastCall.query[0]).toEqual({ key: 'id', value: '123', isActive: true });
    expect(lastCall.query[1]).toEqual({ key: 'name', value: 'test', isActive: true });
  });
});
