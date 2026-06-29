import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { editor } from 'monaco-editor';
import MonacoEditor from './MonacoEditor';

/**
 * Simulates @monaco-editor/react's <Editor>. On unmount it disposes the current
 * model unless `keepCurrentModel` is set — mirroring the library behavior that,
 * with newer monaco-editor versions, crashes the app when the body editor is
 * unmounted (e.g. switching from the request body tab to a tab without an
 * editor) because Trufos shares models across the app.
 */
vi.mock('@monaco-editor/react', () => {
  const React = require('react');
  return {
    __esModule: true,
    Editor: (props: {
      keepCurrentModel?: boolean;
      onMount?: (instance: unknown, monaco: unknown) => void;
    }) => {
      const modelRef = React.useRef<editor.ITextModel | null>(null);
      React.useEffect(() => {
        const instance = {
          setModel: (model: editor.ITextModel) => {
            modelRef.current = model;
          },
          getModel: () => modelRef.current,
        };
        props.onMount?.(instance, {});
        return () => {
          // The real library only disposes the model on unmount when
          // keepCurrentModel is not set.
          if (!props.keepCurrentModel && modelRef.current != null) {
            modelRef.current.dispose();
          }
        };
      }, []);
      return React.createElement('div', { 'data-testid': 'editor' });
    },
  };
});

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

vi.mock('monaco-editor', () => ({ editor: {} }));

function createMockModel() {
  let disposed = false;
  return {
    dispose: vi.fn(() => {
      disposed = true;
    }),
    get isDisposed() {
      return disposed;
    },
  } as unknown as editor.ITextModel & { isDisposed: boolean };
}

describe('MonacoEditor', () => {
  it('keeps the shared model alive when unmounted (no dispose-on-unmount crash)', () => {
    const model = createMockModel() as editor.ITextModel & { isDisposed: boolean };

    const { unmount } = render(<MonacoEditor model={model} />);
    unmount();

    // The shared model must survive unmount; disposing it here is what causes
    // the crash when switching back to the body editor tab.
    expect(model.dispose).not.toHaveBeenCalled();
    expect(model.isDisposed).toBe(false);
  });

  it('attaches the provided model on mount', () => {
    const model = createMockModel();
    const onMount = vi.fn();

    render(<MonacoEditor model={model} onMount={onMount} />);

    expect(onMount).toHaveBeenCalledTimes(1);
  });
});
