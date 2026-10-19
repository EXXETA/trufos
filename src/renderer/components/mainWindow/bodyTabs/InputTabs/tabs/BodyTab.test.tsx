import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RequestBody, RequestBodyType } from 'shim/objects/request';
import { BodyTab } from './BodyTab';

const setRequestBodyMock = vi.fn();
let mockBody: RequestBody = { type: RequestBodyType.NONE };

vi.mock('@/state/collectionStore', () => ({
  useCollectionActions: () => ({
    setRequestBody: setRequestBodyMock,
    setRequestBodyMimeType: vi.fn(),
  }),
  useCollectionStore: (selector: (state: unknown) => unknown) => selector({}),
  selectRequest: () => ({ body: mockBody }),
}));

vi.mock('@/lib/monaco/language', () => ({
  Language: { JSON: 'json', XML: 'xml', TEXT: 'plaintext' },
  isFormattableLanguage: () => true,
  languageToMimeType: () => 'text/plain',
  mimeTypeToLanguage: () => 'plaintext',
}));

vi.mock('./BodyTabTextInput', () => ({ default: () => <div data-testid="text-input" /> }));
vi.mock('./BodyTabFileInput', () => ({ default: () => <div data-testid="file-input" /> }));
vi.mock('./FormDataTab', () => ({ FormDataTab: () => <div data-testid="form-data" /> }));

vi.mock('@/components/mainWindow/bodyTabs/InputTabs/SimpleSelect', () => ({
  SimpleSelect: ({
    onValueChange,
    value,
    items,
  }: {
    onValueChange: (v: string) => void;
    value?: string;
    items: [string, string][];
  }) => (
    <select value={value} onChange={(e) => onValueChange(e.target.value)}>
      {items.map(([val, label]) => (
        <option key={val} value={val}>
          {label}
        </option>
      ))}
    </select>
  ),
}));

/** The select of the body type is always the first one. */
const bodyTypeSelect = (): HTMLElement => screen.getAllByRole('combobox')[0];

describe('BodyTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBody = { type: RequestBodyType.NONE };
  });

  afterEach(() => {
    cleanup();
  });

  it('shows that a request without a body has none', () => {
    render(<BodyTab />);

    expect(screen.getByText('This request does not have a body.')).toBeTruthy();
    expect(bodyTypeSelect()).toHaveProperty('value', RequestBodyType.NONE);
    expect(screen.queryByTestId('text-input')).toBeNull();
  });

  it('offers None as the first body type', () => {
    render(<BodyTab />);

    const labels = Array.from(bodyTypeSelect().querySelectorAll('option')).map(
      (option) => option.textContent
    );
    expect(labels).toEqual(['None', 'Text', 'File', 'Form Data']);
  });

  it.each([
    [RequestBodyType.NONE, { type: RequestBodyType.NONE }],
    [RequestBodyType.TEXT, { type: RequestBodyType.TEXT, mimeType: 'text/plain' }],
    [RequestBodyType.FILE, { type: RequestBodyType.FILE }],
    [RequestBodyType.FORM_DATA, { type: RequestBodyType.FORM_DATA, fields: [] }],
  ])('sets the initial body when switching to %s', (type, body) => {
    // start from another type, as selecting the current one does not change anything
    mockBody =
      type === RequestBodyType.NONE
        ? { type: RequestBodyType.FILE }
        : { type: RequestBodyType.NONE };
    render(<BodyTab />);

    fireEvent.change(bodyTypeSelect(), { target: { value: type } });

    expect(setRequestBodyMock).toHaveBeenCalledWith(body);
  });

  it('keeps the type select when switching to and from a text body, so it keeps the focus', () => {
    const { rerender } = render(<BodyTab />);
    const select = bodyTypeSelect();

    mockBody = { type: RequestBodyType.TEXT, mimeType: 'text/plain' };
    rerender(<BodyTab />);
    expect(bodyTypeSelect()).toBe(select);

    mockBody = { type: RequestBodyType.NONE };
    rerender(<BodyTab />);
    expect(bodyTypeSelect()).toBe(select);
  });

  it('shows the editor, language and format button for a text body', () => {
    mockBody = { type: RequestBodyType.TEXT, mimeType: 'text/plain' };
    render(<BodyTab />);

    expect(screen.getByTestId('text-input')).toBeTruthy();
    expect(screen.getAllByRole('combobox')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Format' })).toBeTruthy();
  });

  it.each([
    [{ type: RequestBodyType.FILE }, 'file-input'],
    [{ type: RequestBodyType.FORM_DATA, fields: [] }, 'form-data'],
  ] satisfies [RequestBody, string][])('shows the editor of a %o body', (body, testId) => {
    mockBody = body;
    render(<BodyTab />);

    expect(screen.getByTestId(testId)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Format' })).toBeNull();
  });
});
