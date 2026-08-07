import {
  SINGLE_LINE_EDITOR_HEIGHT,
  SINGLE_LINE_EDITOR_OPTIONS,
} from '@/components/shared/settings/monaco-settings';
import { Language } from '@/lib/monaco/language';
import MonacoEditor from '@/lib/monaco/MonacoEditor';
import { cn } from '@/lib/utils';
import { OnMount } from '@monaco-editor/react';
import { KeyCode } from 'monaco-editor';

/** Matches the line breaks that a single line editor must not contain. */
const LINE_BREAK_REGEX = /[\r\n]+/g;

const handleMount: OnMount = (editor) => {
  // swallow the line break, but keep enter usable for accepting a variable suggestion
  editor.addCommand(KeyCode.Enter, () => {}, '!suggestWidgetVisible');
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
        onChange={(newValue = '') => onChange(newValue.replace(LINE_BREAK_REGEX, ''))}
      />
    </div>
  );
}
