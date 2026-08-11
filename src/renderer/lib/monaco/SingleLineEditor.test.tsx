import { render, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { KeyCode, type editor } from 'monaco-editor';
import { EditorProps, OnMount } from '@monaco-editor/react';
import { useEffect } from 'react';

// only KeyCode is used at runtime, and monaco itself does not run under jsdom
vi.mock('monaco-editor', () => ({ KeyCode: { Enter: 3 } }));

const addCommand = vi.fn();
const dispose = vi.fn();
const addAction = vi.fn(() => ({ dispose }));

/** Disposes the editor the same way monaco does when the component unmounts. */
let disposeEditor: () => void;
const onDidDispose = vi.fn((listener: () => void) => (disposeEditor = listener));

/** The props that {@link SingleLineEditor} passed to the monaco editor on the last render. */
let editorProps: EditorProps;

// monaco does not run under jsdom, so the editor is replaced by a stub capturing its props
vi.mock('@/lib/monaco/MonacoEditor', () => ({
  default: (props: EditorProps) => {
    editorProps = props;
    useEffect(() => {
      (props.onMount as OnMount)?.(
        { addCommand, addAction, onDidDispose } as unknown as editor.IStandaloneCodeEditor,
        {} as Parameters<OnMount>[1] // the component does not use the monaco namespace
      );
    }, []);
    return <div data-testid="monaco-editor" />;
  },
}));

vi.mock('@/lib/monaco/language', () => ({ Language: { TEXT: 'plaintext' } }));

vi.mock('@/components/shared/settings/monaco-settings', () => ({
  SINGLE_LINE_EDITOR_HEIGHT: 20,
  SINGLE_LINE_EDITOR_OPTIONS: {},
}));

import { SingleLineEditor } from './SingleLineEditor';

describe('SingleLineEditor', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it('should show the value in a plaintext editor to highlight template variables', () => {
    // Arrange
    render(<SingleLineEditor value="{{ baseUrl }}/users" onChange={vi.fn()} />);

    // Assert
    expect(editorProps.value).toBe('{{ baseUrl }}/users');
    expect(editorProps.language).toBe('plaintext');
  });

  it('should report changes made by the user', () => {
    // Arrange
    const onChange = vi.fn();
    render(<SingleLineEditor value="https://" onChange={onChange} />);

    // Act
    editorProps.onChange?.('https://example.com', {} as editor.IModelContentChangedEvent);

    // Assert
    expect(onChange).toHaveBeenCalledWith('https://example.com');
  });

  it('should strip line breaks from the reported value', () => {
    // Arrange
    const onChange = vi.fn();
    render(<SingleLineEditor value="https://" onChange={onChange} />);

    // Act
    editorProps.onChange?.('https://example\n.com\r\n', {} as editor.IModelContentChangedEvent);

    // Assert
    expect(onChange).toHaveBeenCalledWith('https://example.com');
  });

  it('should report an empty value when the editor is cleared', () => {
    // Arrange
    const onChange = vi.fn();
    render(<SingleLineEditor value="https://" onChange={onChange} />);

    // Act
    editorProps.onChange?.(undefined, {} as editor.IModelContentChangedEvent);

    // Assert
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('should swallow enter unless the suggestion widget is open', () => {
    // Arrange
    render(<SingleLineEditor value="" onChange={vi.fn()} />);

    // Assert
    expect(addAction).toHaveBeenCalledWith(
      expect.objectContaining({
        keybindings: [KeyCode.Enter],
        keybindingContext: '!suggestWidgetVisible',
      })
    );
  });

  it('should register the enter keybinding as an action so that other editors keep line breaks', () => {
    // Arrange
    render(<SingleLineEditor value="" onChange={vi.fn()} />);

    // Assert: addCommand would register the keybinding for all editors, addAction only for this one
    expect(addCommand).not.toHaveBeenCalled();
    expect(addAction).toHaveBeenCalledTimes(1);
  });

  it('should unregister the enter keybinding when the editor is disposed', () => {
    // Arrange
    render(<SingleLineEditor value="" onChange={vi.fn()} />);
    expect(dispose).not.toHaveBeenCalled();

    // Act
    disposeEditor();

    // Assert
    expect(dispose).toHaveBeenCalled();
  });

  it('should show the error color when invalid', () => {
    // Arrange
    const { container } = render(<SingleLineEditor value="" invalid onChange={vi.fn()} />);

    // Assert
    expect(container.firstElementChild?.className).toContain('border-(--error)');
  });

  it('should not show the error color when valid', () => {
    // Arrange
    const { container } = render(<SingleLineEditor value="" onChange={vi.fn()} />);

    // Assert
    expect(container.firstElementChild?.className).not.toContain('border-(--error)');
  });
});
