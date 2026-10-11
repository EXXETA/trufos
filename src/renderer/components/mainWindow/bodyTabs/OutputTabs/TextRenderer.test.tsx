import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { editor } from 'monaco-editor';

const { useBodyDataMock, formatMock, instance } = vi.hoisted(() => ({
  useBodyDataMock: vi.fn(),
  formatMock: vi.fn(() => Promise.resolve()),
  instance: { id: 'editor' },
}));

vi.mock('@/hooks/useBodyData', () => ({ useBodyData: useBodyDataMock }));
vi.mock('@/lib/monaco/format', () => ({ formatReadOnlyEditor: formatMock }));
vi.mock('@/lib/monaco/language', () => ({ mimeTypeToLanguage: () => 'json' }));
vi.mock('monaco-editor', () => ({ editor: { setModelLanguage: vi.fn() } }));
vi.mock('@/lib/monaco/MonacoEditor', () => ({
  default: ({ onMount }: { onMount: (instance: unknown) => void }) => {
    onMount(instance);
    return <div data-testid="editor" />;
  },
}));

import { TextRenderer } from './TextRenderer';

const setValue = vi.fn();
// only setValue is used, the editor itself is mocked
const model = { setValue } as Partial<editor.ITextModel> as editor.ITextModel;
const body = { id: 'body', size: 2 };

/** Passes content to the renderer like the body stream would. */
function receive(content: string) {
  const onChange = useBodyDataMock.mock.lastCall![2] as (content: string) => void;
  act(() => onChange(content));
}

describe('TextRenderer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the body formatted once it is loaded', () => {
    render(<TextRenderer body={body} mimeType="application/json" model={model} format />);

    receive('{"a":1}');

    expect(setValue).toHaveBeenCalledWith('{"a":1}');
    expect(formatMock).toHaveBeenCalledWith(instance);
  });

  it('shows the body as it is without formatting it', () => {
    render(<TextRenderer body={body} model={model} format={false} />);

    receive('{"a":1}');

    expect(setValue).toHaveBeenCalledWith('{"a":1}');
    expect(formatMock).not.toHaveBeenCalled();
  });

  it('switches between raw and formatted output without loading the body again', () => {
    const { rerender } = render(<TextRenderer body={body} model={model} format />);
    receive('{"a":1}');
    const loads = useBodyDataMock.mock.calls.length;
    setValue.mockClear();
    formatMock.mockClear();

    rerender(<TextRenderer body={body} model={model} format={false} />);

    expect(setValue).toHaveBeenCalledWith('{"a":1}');
    expect(formatMock).not.toHaveBeenCalled();
    // the hook is called on every render, but always with the same stream arguments
    expect(useBodyDataMock.mock.calls.slice(loads).every((call) => call[0] === 'body')).toBe(true);
    expect(new Set(useBodyDataMock.mock.calls.map((call) => call[2])).size).toBe(1);
  });
});
