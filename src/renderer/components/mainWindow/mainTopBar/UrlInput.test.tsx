import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { parseUrl } from 'shim/objects/url';

// monaco does not run under jsdom, so the editor is replaced by a plain input here. Its own
// behavior is covered by SingleLineEditor.test.tsx.
vi.mock('@/lib/monaco/SingleLineEditor', () => ({
  SingleLineEditor: ({
    value,
    onChange,
    invalid,
  }: {
    value: string;
    onChange: (value: string) => void;
    invalid?: boolean;
  }) => (
    <input
      value={value}
      data-invalid={invalid}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

/** Stands in for the variable resolution of the main process. Defaults to a string without variables. */
let resolve: (string: string) => string | null | undefined;

vi.mock('@/hooks/useResolvedString', () => ({
  useResolvedString: (string: string) => resolve(string),
}));

import { UrlInput } from './UrlInput';

describe('UrlInput', () => {
  beforeEach(() => {
    resolve = (string) => string;
  });

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

  it('should mark invalid URLs', async () => {
    // Arrange
    const user = userEvent.setup();
    const url = parseUrl('https://example.com');
    const { getByRole } = render(<UrlInput url={url} onChange={vi.fn()} />);

    // Act
    const input = getByRole('textbox') as HTMLInputElement;
    await user.clear(input);
    await user.type(input, 'not-a-valid-url');

    // Assert
    expect(input.dataset.invalid).toBe('true');
  });

  it('should accept a URL with variables that resolves to a valid URL', async () => {
    // Arrange
    const user = userEvent.setup();
    resolve = () => 'https://api.example.com/users';
    const { getByRole } = render(<UrlInput url={parseUrl('')} onChange={vi.fn()} />);

    // Act
    const input = getByRole('textbox') as HTMLInputElement;
    await user.type(input, '{{{{ baseUrl }}/users');

    // Assert
    expect(input.value).toBe('{{ baseUrl }}/users');
    expect(input.dataset.invalid).toBe('false');
  });

  it('should reject a URL with variables that resolves to an invalid URL', async () => {
    // Arrange
    const user = userEvent.setup();
    resolve = () => '/users';
    const { getByRole } = render(<UrlInput url={parseUrl('')} onChange={vi.fn()} />);

    // Act
    const input = getByRole('textbox') as HTMLInputElement;
    await user.type(input, '{{{{ basePath }}/users');

    // Assert
    expect(input.dataset.invalid).toBe('true');
  });

  it('should reject a URL with an undefined variable', async () => {
    // Arrange
    const user = userEvent.setup();
    resolve = () => null;
    const { getByRole } = render(<UrlInput url={parseUrl('')} onChange={vi.fn()} />);

    // Act
    const input = getByRole('textbox') as HTMLInputElement;
    await user.type(input, '{{{{ missing }}/users');

    // Assert
    expect(input.dataset.invalid).toBe('true');
  });

  it('should not mark the URL as invalid while the variables are being resolved', () => {
    // Arrange
    resolve = () => undefined;

    // Act
    const { getByRole } = render(
      <UrlInput url={parseUrl('{{ baseUrl }}/users')} onChange={vi.fn()} />
    );

    // Assert
    expect((getByRole('textbox') as HTMLInputElement).dataset.invalid).toBe('false');
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
