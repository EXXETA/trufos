import { editor, languages, Position } from 'monaco-editor';

const variables = new Map([['$randomUuid', '9d81997b-20ae-4543-995e-52e81e7b30ae']]); // TODO: fetch from environment service

/**
 * Completion items provider for template variables in any text document.
 */
export class TemplateVariableCompletionItemsProvider implements languages.CompletionItemProvider {
  triggerCharacters = ['{'];

  private static readonly MAX_VARIABLE_NAME_LENGTH = 100;

  provideCompletionItems(model: editor.ITextModel, position: Position): languages.CompletionList {
    const suggestions: languages.CompletionItem[] = [];
    const startColumn = position.column - 2;

    if (
      position.column > 2 &&
      model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      }) === '{{'
    ) {
      // find the matching closing bracket in the same line
      const match = /\{\{\s*}}/.exec(
        model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn,
          endLineNumber: position.lineNumber,
          endColumn: Math.min(
            position.column + TemplateVariableCompletionItemsProvider.MAX_VARIABLE_NAME_LENGTH,
            model.getLineMaxColumn(position.lineNumber)
          ),
        })
      );

      // create completion items for all variables
      for (const [label, value] of variables.entries()) {
        suggestions.push({
          label,
          kind: languages.CompletionItemKind.Variable,
          insertText: ` ${label} }}`, // add variable name and closing bracket
          range: {
            startLineNumber: position.lineNumber,
            startColumn: position.column,
            endLineNumber: position.lineNumber,
            endColumn: match === null ? position.column : startColumn + match[0].length,
          },
          detail: value,
        });
      }
    }

    return { suggestions };
  }
}
