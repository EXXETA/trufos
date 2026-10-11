import { editor } from 'monaco-editor';

/**
 * Formats the document of a read-only editor. The formatter refuses to edit read-only documents,
 * so the editor is made editable for the duration of the formatting.
 * @param instance the editor to format
 */
export async function formatReadOnlyEditor(instance: editor.ICodeEditor): Promise<void> {
  try {
    instance.updateOptions({ readOnly: false });
    await instance.getAction('editor.action.formatDocument')?.run();
  } finally {
    instance.updateOptions({ readOnly: true });
  }
}
