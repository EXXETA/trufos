import {
  SINGLE_LINE_EDITOR_HEIGHT,
  SINGLE_LINE_EDITOR_OPTIONS,
} from '@/components/shared/settings/monaco-settings';
import { Language } from '@/lib/monaco/language';
import MonacoEditor from '@/lib/monaco/MonacoEditor';
import { cn } from '@/lib/utils';
import { OnMount } from '@monaco-editor/react';
import { KeyCode, type editor as monacoEditor } from 'monaco-editor';

/** Matches the line breaks that a single line editor must not contain. */
const LINE_BREAK_REGEX = /[\r\n]+/g;

/**
 * Swallows the line break, but keeps enter usable for accepting a variable suggestion.
 *
 * This must be registered via `addAction` instead of `addCommand`: monaco holds the keybindings of
 * all editors in one global service, and only `addAction` scopes them to the editor they are added
 * to. Otherwise the multi line editors lose their line breaks as well.
 */
const IGNORE_LINE_BREAK_ACTION: monacoEditor.IActionDescriptor = {
  id: 'trufos.ignoreLineBreak',
  label: 'Ignore Line Break',
  keybindings: [KeyCode.Enter],
  keybindingContext: '!suggestWidgetVisible',
  run: () => {},
};

const handleMount: OnMount = (editor) => {
  const action = editor.addAction(IGNORE_LINE_BREAK_ACTION);
  editor.onDidDispose(() => action.dispose());
};

interface SingleLineEditorProps {
  /** The text to show in the editor. */
  value: string;

  /** Called with the new text whenever the user changes it. */
  onChange: (value: string) => void;

  /** Whether to mark the editor with the error color. */
  invalid?: boolean;

  /** The label announced by screen readers. */
  ariaLabel?: string;

  className?: string;
}

/**
 * A single line text input backed by monaco. In contrast to a plain HTML input, it highlights
 * template variables and shows their current value on hover, just like the request body editor.
 *
 * Line breaks are stripped from the reported value, so the {@link SingleLineEditorProps.value} must
 * be updated on change to keep pasted text on a single line.
 */
export function SingleLineEditor({
  value,
  onChange,
  invalid,
  ariaLabel,
  className,
}: SingleLineEditorProps) {
  return (
    <div
      className={cn(
        'border-border bg-background focus-within:border-accent-secondary flex h-10 items-center overflow-hidden rounded-full border px-3',
        { 'border-(--error)': invalid },
        className
      )}
    >
      <MonacoEditor
        height={SINGLE_LINE_EDITOR_HEIGHT}
        language={Language.TEXT}
        value={value}
        options={{ ...SINGLE_LINE_EDITOR_OPTIONS, ariaLabel }}
        loading={null}
        onMount={handleMount}
        onChange={(newValue = '') => onChange(newValue)}
      />
    </div>
  );
}
