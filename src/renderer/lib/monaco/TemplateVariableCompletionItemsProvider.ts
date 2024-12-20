import { editor, languages, Position } from 'monaco-editor';
import { RendererEventService } from '@/services/event/renderer-event-service';

const eventService = RendererEventService.instance;

/**
 * Completion items provider for template variables in any text document.
 */
export class TemplateVariableCompletionItemsProvider implements languages.CompletionItemProvider {
  triggerCharacters = ['{'];

  private static readonly MAX_VARIABLE_NAME_LENGTH = 100;

  async provideCompletionItems(
    model: editor.ITextModel,
    position: Position
  ): Promise<languages.CompletionList> {
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
      for (const variable of await eventService.getActiveEnvironmentVariables()) {
        console.log(variable);
        suggestions.push({
          label: variable.key,
          kind: languages.CompletionItemKind.Variable,
          insertText: ` ${variable.key} }}`, // add variable name and closing bracket
          range: {
            startLineNumber: position.lineNumber,
            startColumn: position.column,
            endLineNumber: position.lineNumber,
            endColumn: match === null ? position.column : startColumn + match[0].length,
          },
          detail: variable.description,
        });
      }
    }

    return { suggestions };
  }
}
