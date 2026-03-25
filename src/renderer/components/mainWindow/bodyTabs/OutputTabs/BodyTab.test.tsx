import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BodyTab } from './BodyTab';
import { RESPONSE_BODY_SIZE_LIMIT } from './PrettyRenderer';
import { TrufosResponse } from 'shim/objects/response';

// Mock IPC stream (requires window.electron which doesn't exist in jsdom)
vi.mock('@/lib/ipc-stream', () => ({
  IpcPushStream: { open: vi.fn() },
}));

// Mock Monaco-related modules
vi.mock('@/lib/monaco/language', () => ({
  isFormattableLanguage: vi.fn(() => true),
  mimeTypeToLanguage: vi.fn(() => 'json'),
}));

// Mock child renderers to avoid Monaco editor in tests
vi.mock('./DefaultRenderer', () => ({
  DefaultRenderer: ({ skip }: { skip?: boolean }) => (
    <div data-testid="default-renderer" data-skip={String(skip)} />
  ),
}));
vi.mock('./TextualPrettyRenderer', () => ({
  TextualPrettyRenderer: ({ skip }: { skip?: boolean }) => (
    <div data-testid="textual-renderer" data-skip={String(skip)} />
  ),
}));
vi.mock('./ImagePrettyRenderer', () => ({
  ImagePrettyRenderer: () => <div data-testid="image-renderer" />,
}));

const REQUEST_ID = 'test-request-id';

vi.mock('@/state/collectionStore', () => ({
  useCollectionStore: (selector: (state: unknown) => unknown) =>
    selector({ selectedRequestId: REQUEST_ID }),
  selectRequest: () => ({ id: REQUEST_ID }),
}));

const makeResponse = (bodySizeInBytes: number, contentType?: string): TrufosResponse => ({
  type: 'response',
  id: 'test-response-id',
  headers: contentType ? { 'content-type': contentType } : {},
  metaInfo: {
    status: 200,
    duration: 100,
    size: { totalSizeInBytes: bodySizeInBytes, headersSizeInBytes: 0, bodySizeInBytes },
  },
});

let mockResponse: TrufosResponse | undefined;

vi.mock('@/state/responseStore', () => ({
  useResponseStore: (selector: (state: unknown) => unknown) =>
    selector({
      responseInfoMap: { [REQUEST_ID]: mockResponse },
      editor: undefined,
    }),
  selectResponse: (state: { responseInfoMap: Record<string, TrufosResponse> }, id: string) =>
    state.responseInfoMap[id],
  useResponseActions: () => ({
    setResponseEditor: vi.fn(),
    formatResponseEditorText: vi.fn(),
  }),
}));

describe('BodyTab', () => {
  beforeEach(() => {
    mockResponse = undefined;
  });

  it('shows dialog when response body exceeds size limit', async () => {
    mockResponse = makeResponse(RESPONSE_BODY_SIZE_LIMIT + 1);
    render(<BodyTab />);

    expect(screen.getByText('Large Response Body')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Load anyway' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
  });

  it('does not show dialog when response body is within size limit', () => {
    mockResponse = makeResponse(RESPONSE_BODY_SIZE_LIMIT - 1);
    render(<BodyTab />);

    expect(screen.queryByText('Large Response Body')).toBeNull();
  });

  it('passes skip=true to renderer when body is too large', () => {
    mockResponse = makeResponse(RESPONSE_BODY_SIZE_LIMIT + 1);
    render(<BodyTab />);

    expect(screen.getByTestId('default-renderer').getAttribute('data-skip')).toBe('true');
  });

  it('closes dialog and loads content when Load anyway is clicked', async () => {
    const user = userEvent.setup();
    mockResponse = makeResponse(RESPONSE_BODY_SIZE_LIMIT + 1);
    render(<BodyTab />);

    await user.click(screen.getByRole('button', { name: 'Load anyway' }));

    expect(screen.queryByText('Large Response Body')).toBeNull();
    expect(screen.getByTestId('default-renderer').getAttribute('data-skip')).toBe('false');
  });

  it('shows placeholder with Load anyway button after Cancel', async () => {
    const user = userEvent.setup();
    mockResponse = makeResponse(RESPONSE_BODY_SIZE_LIMIT + 1);
    render(<BodyTab />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText('Large Response Body')).toBeNull();
    expect(screen.getByText(/was not loaded/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Load anyway' })).toBeTruthy();
  });

  it('loads content when Load anyway is clicked from placeholder', async () => {
    const user = userEvent.setup();
    mockResponse = makeResponse(RESPONSE_BODY_SIZE_LIMIT + 1);
    render(<BodyTab />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Load anyway' }));

    expect(screen.getByTestId('default-renderer').getAttribute('data-skip')).toBe('false');
  });
});
