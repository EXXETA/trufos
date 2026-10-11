import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RESPONSE_BODY_SIZE_LIMIT } from '@/components/mainWindow/bodyTabs/OutputTabs/PrettyRenderer';

const { openMock, downloadMock, setValueMock, disposeMock } = vi.hoisted(() => ({
  openMock: vi.fn(),
  downloadMock: vi.fn(() => Promise.resolve(null)),
  setValueMock: vi.fn(),
  disposeMock: vi.fn(),
}));

vi.mock('@/lib/ipc-stream', () => ({ IpcPushStream: { open: openMock } }));

vi.mock('monaco-editor', () => ({
  editor: { createModel: () => ({ setValue: setValueMock, dispose: disposeMock }) },
}));

vi.mock('@/lib/monaco/MonacoEditor', () => ({ default: () => <div data-testid="editor" /> }));

vi.mock('@/lib/monaco/language', () => ({
  isFormattableLanguage: () => false,
  mimeTypeToLanguage: () => 'json',
}));

vi.mock('@/services/event/renderer-event-service', () => ({
  RendererEventService: { instance: { downloadResponse: downloadMock } },
}));

import { HistoryBodyViewer } from './HistoryBodyViewer';

function mockStream(content: string) {
  openMock.mockResolvedValue({ readAll: () => Promise.resolve(content), close: vi.fn() });
}

describe('HistoryBodyViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should stream the stored body into the editor', async () => {
    mockStream('{"a":1}');

    render(
      <HistoryBodyViewer
        body={{ id: 'body-1', size: 7 }}
        headers={{ 'content-type': 'application/json; charset=utf-8' }}
      />
    );

    await waitFor(() => expect(setValueMock).toHaveBeenCalledWith('{"a":1}'));
    expect(openMock).toHaveBeenCalledWith({ type: 'body', id: 'body-1' }, 'utf-8', undefined);
    screen.getByText(/application\/json/);
  });

  it('should only load the first part of large bodies', async () => {
    mockStream('');

    render(
      <HistoryBodyViewer body={{ id: 'big', size: RESPONSE_BODY_SIZE_LIMIT + 1 }} headers={{}} />
    );

    await waitFor(() =>
      expect(openMock).toHaveBeenCalledWith(
        { type: 'body', id: 'big' },
        'utf-8',
        RESPONSE_BODY_SIZE_LIMIT
      )
    );
    screen.getByText(/showing the first/);
  });

  it('should show images', async () => {
    mockStream('aGVsbG8=');

    render(
      <HistoryBodyViewer
        body={{ id: 'image', size: 5 }}
        headers={{ 'content-type': 'image/png' }}
      />
    );

    const image = await screen.findByRole('img');
    expect(image.getAttribute('src')).toBe('data:image/png;base64,aGVsbG8=');
    expect(openMock).toHaveBeenCalledWith({ type: 'body', id: 'image' }, 'base64', undefined);
  });

  it('should download the full body', async () => {
    mockStream('');
    render(<HistoryBodyViewer body={{ id: 'body-1', size: 1 }} headers={{}} />);

    await userEvent.click(screen.getByRole('button', { name: 'Save body' }));

    expect(downloadMock).toHaveBeenCalledWith('body-1');
  });

  it('should dispose its editor model when closed', () => {
    mockStream('');
    const { unmount } = render(<HistoryBodyViewer body={{ id: 'body-1', size: 1 }} headers={{}} />);

    unmount();

    expect(disposeMock).toHaveBeenCalled();
  });
});
