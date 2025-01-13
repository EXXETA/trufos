import { editor, IPosition, IRange } from 'monaco-editor';

class MockModel implements Partial<editor.ITextModel> {
  constructor(private readonly lines: string[]) {}

  getValueInRange(range: IRange) {
    if (range.startLineNumber !== range.endLineNumber)
      throw new Error('Range must be in the same line');
    return this.lines[range.startLineNumber - 1].slice(range.startColumn - 1, range.endColumn - 1);
  }

  getLineMaxColumn(lineNumber: number) {
    return this.lines[lineNumber - 1].length + 1;
  }

  getLineCount() {
    return this.lines.length;
  }

  getLineContent(lineNumber: number) {
    return this.lines[lineNumber - 1];
  }

  getWordAtPosition(position: IPosition) {
    const prefixLength = /\w*$/.exec(
      this.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      })
    )[0].length;
    const postfixLength = /^\w*/.exec(
      this.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: position.column,
        endLineNumber: position.lineNumber,
        endColumn: this.getLineMaxColumn(position.lineNumber),
      })
    )[0].length;

    const startColumn = position.column - prefixLength;
    const endColumn = position.column + postfixLength;
    if (startColumn === endColumn) {
      return null;
    }

    return {
      word: this.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn,
        endLineNumber: position.lineNumber,
        endColumn,
      }),
      startColumn,
      endColumn,
    };
  }
}

/**
 * Mock a monaco editor model.
 * @param json The JSON content of the model as object.
 */
export function mockModel(json: object) {
  const lines = JSON.stringify(json, null, 2).split('\n');
  return new MockModel(lines) as Partial<editor.ITextModel> as editor.ITextModel;
}
