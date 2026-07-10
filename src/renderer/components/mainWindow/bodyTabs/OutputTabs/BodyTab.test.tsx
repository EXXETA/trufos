import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BodyTab } from './BodyTab';
import { RESPONSE_BODY_SIZE_LIMIT } from './PrettyRenderer';
import { TrufosResponse } from 'shim/objects/response';

vi.mock('@/lib/ipc-stream', () => ({
  IpcPushStream: { open: vi.fn() },
}));

vi.mock('@/lib/monaco/language', () => ({
  isFormattableLanguage: vi.fn(() => true),
  mimeTypeToLanguage: vi.fn(() => 'json'),
}));

vi.mock('./DefaultRenderer', () => ({
  DefaultRenderer: ({ maxBytes }: { maxBytes?: number }) => (
    <div data-testid="default-renderer" data-max-bytes={String(maxBytes)} />
  ),
}));
vi.mock('./TextualPrettyRenderer', () => ({
  TextualPrettyRenderer: ({ maxBytes }: { maxBytes?: number }) => (
    <div data-testid="textual-renderer" data-max-bytes={String(maxBytes)} />
  ),
}));
vi.mock('./ImagePrettyRenderer', () => ({
  ImagePrettyRenderer: () => <div data-testid="image-renderer" />,
}));

const REQUEST_ID = 'test-request-id';

vi.mock('@/state/appStore', () => ({
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

  it('renders content renderer immediately for small responses', () => {
    mockResponse = makeResponse(RESPONSE_BODY_SIZE_LIMIT - 1);
    render(<BodyTab />);

    expect(screen.queryByTestId('default-renderer')).not.toBeNull();
  });

  it('renders content renderer immediately for large responses without blocking dialog', () => {
    mockResponse = makeResponse(RESPONSE_BODY_SIZE_LIMIT + 1);
    render(<BodyTab />);

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByTestId('default-renderer')).not.toBeNull();
  });

  it('passes maxBytes to renderer when response exceeds size limit', () => {
    mockResponse = makeResponse(RESPONSE_BODY_SIZE_LIMIT + 1);
    render(<BodyTab />);

    expect(screen.getByTestId('default-renderer').getAttribute('data-max-bytes')).toBe(
      String(RESPONSE_BODY_SIZE_LIMIT)
    );
  });

  it('passes no maxBytes to renderer when response is within size limit', () => {
    mockResponse = makeResponse(RESPONSE_BODY_SIZE_LIMIT - 1);
    render(<BodyTab />);

    expect(screen.getByTestId('default-renderer').getAttribute('data-max-bytes')).toBe('undefined');
  });

  it('shows load more button when response exceeds size limit', () => {
    mockResponse = makeResponse(RESPONSE_BODY_SIZE_LIMIT + 1);
    render(<BodyTab />);

    expect(screen.getByRole('button', { name: /load more/i })).toBeTruthy();
  });

  it('does not show load more button when response is within size limit', () => {
    mockResponse = makeResponse(RESPONSE_BODY_SIZE_LIMIT - 1);
    render(<BodyTab />);

    expect(screen.queryByRole('button', { name: /load more/i })).toBeNull();
  });

  it('removes maxBytes and load more button after load more is clicked', async () => {
    const user = userEvent.setup();
    mockResponse = makeResponse(RESPONSE_BODY_SIZE_LIMIT + 1);
    render(<BodyTab />);

    await user.click(screen.getByRole('button', { name: /load more/i }));

    expect(screen.getByTestId('default-renderer').getAttribute('data-max-bytes')).toBe('undefined');
    expect(screen.queryByRole('button', { name: /load more/i })).toBeNull();
  });
});
