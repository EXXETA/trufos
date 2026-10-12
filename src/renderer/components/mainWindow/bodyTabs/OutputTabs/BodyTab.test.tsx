import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { BodyTab } from './BodyTab';
import { BODY_SIZE_LIMIT } from '@/lib/body';
import type { editor } from 'monaco-editor';
import type { StoredBody } from 'shim/objects/response';
import type { HttpHeaders } from 'shim/headers';
import { getSizeText } from '@/util/format-util';

vi.mock('@/lib/ipc-stream', () => ({
  IpcPushStream: { open: vi.fn() },
}));

vi.mock('@/lib/monaco/language', () => ({
  isFormattableLanguage: vi.fn(() => true),
  mimeTypeToLanguage: vi.fn(() => 'json'),
}));

vi.mock('./TextRenderer', () => ({
  TextRenderer: ({ maxBytes, format }: { maxBytes?: number; format: boolean }) => (
    <div
      data-testid="text-renderer"
      data-max-bytes={String(maxBytes)}
      data-format={String(format)}
    />
  ),
}));
vi.mock('./ImagePrettyRenderer', () => ({
  ImagePrettyRenderer: () => <div data-testid="image-renderer" />,
}));

const { downloadMock } = vi.hoisted(() => ({
  downloadMock: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('@/services/event/renderer-event-service', () => ({
  RendererEventService: { instance: { downloadBody: downloadMock } },
}));

const makeBody = (size: number): StoredBody => ({ id: 'test-body-id', size });

// the renderers are mocked, so the model is never used
const model = {} as editor.ITextModel;

const renderBodyTab = (body?: StoredBody, headers: HttpHeaders = {}) =>
  render(<BodyTab body={body} headers={headers} model={model} />);

describe('BodyTab', () => {
  it('renders content renderer immediately for small responses', () => {
    renderBodyTab(makeBody(BODY_SIZE_LIMIT - 1));

    expect(screen.queryByTestId('text-renderer')).not.toBeNull();
  });

  it('renders content renderer immediately for large responses without blocking dialog', () => {
    renderBodyTab(makeBody(BODY_SIZE_LIMIT + 1));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByTestId('text-renderer')).not.toBeNull();
  });

  it('passes maxBytes to renderer when response exceeds size limit', () => {
    renderBodyTab(makeBody(BODY_SIZE_LIMIT + 1));

    expect(screen.getByTestId('text-renderer').getAttribute('data-max-bytes')).toBe(
      String(BODY_SIZE_LIMIT)
    );
  });

  it('passes no maxBytes to renderer when response is within size limit', () => {
    renderBodyTab(makeBody(BODY_SIZE_LIMIT - 1));

    expect(screen.getByTestId('text-renderer').getAttribute('data-max-bytes')).toBe('undefined');
  });

  it('shows load more button when response exceeds size limit', () => {
    renderBodyTab(makeBody(BODY_SIZE_LIMIT + 1));

    expect(screen.getByRole('button', { name: /load more/i })).toBeTruthy();
  });

  it('does not show load more button when response is within size limit', () => {
    renderBodyTab(makeBody(BODY_SIZE_LIMIT - 1));

    expect(screen.queryByRole('button', { name: /load more/i })).toBeNull();
  });

  it('removes maxBytes and load more button after load more is clicked', async () => {
    const user = userEvent.setup();
    renderBodyTab(makeBody(BODY_SIZE_LIMIT + 1));

    await user.click(screen.getByRole('button', { name: /load more/i }));

    expect(screen.getByTestId('text-renderer').getAttribute('data-max-bytes')).toBe('undefined');
    expect(screen.queryByRole('button', { name: /load more/i })).toBeNull();
  });

  it('shows the sizes in the load more banner like the status bar', () => {
    renderBodyTab(makeBody(BODY_SIZE_LIMIT + 1));

    screen.getByText(
      `Showing first ${getSizeText(BODY_SIZE_LIMIT)} of ${getSizeText(BODY_SIZE_LIMIT + 1)}`
    );
  });

  it('shows images with the image renderer', () => {
    renderBodyTab(makeBody(10), { 'content-type': 'image/png; charset=binary' });

    expect(screen.queryByTestId('image-renderer')).not.toBeNull();
  });

  it('saves the body', async () => {
    renderBodyTab(makeBody(10));

    await userEvent.click(screen.getByTitle('Save body'));

    expect(downloadMock).toHaveBeenCalledWith('test-body-id');
  });

  it('cannot save a missing body', () => {
    renderBodyTab(undefined);

    expect(screen.getByTitle('Save body')).toHaveProperty('disabled', true);
  });

  it('shows formattable bodies formatted', () => {
    renderBodyTab(makeBody(10), { 'content-type': 'application/json' });

    expect(screen.getByTestId('text-renderer').getAttribute('data-format')).toBe('true');
  });

  it('shows partially loaded bodies as they are', () => {
    renderBodyTab(makeBody(BODY_SIZE_LIMIT + 1), { 'content-type': 'application/json' });

    expect(screen.getByTestId('text-renderer').getAttribute('data-format')).toBe('false');
  });

  it('shows bodies without a known content type as they are', () => {
    renderBodyTab(makeBody(10));

    expect(screen.getByTestId('text-renderer').getAttribute('data-format')).toBe('false');
  });
});
