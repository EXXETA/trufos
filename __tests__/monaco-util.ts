import { editor, IRange } from 'monaco-editor';

/**
 * Mock a monaco editor model.
 * @param json The JSON content of the model as object.
 */
export function mockModel(json: object) {
  const lines = JSON.stringify(json, null, 2).split('\n');
  return {
    getValueInRange(range: IRange) {
      if (range.startLineNumber !== range.endLineNumber)
        throw new Error('Range must be in the same line');
      return lines[range.startLineNumber - 1].slice(range.startColumn - 1, range.endColumn - 1);
    },

    getLineMaxColumn(lineNumber: number) {
      return lines[lineNumber - 1].length + 1;
    },

    getLineCount() {
      return lines.length;
    },

    getLineContent(lineNumber: number) {
      return lines[lineNumber - 1];
    },
  } as editor.ITextModel;
}
