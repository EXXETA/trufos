import { editor, languages, Position } from 'monaco-editor';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { MAX_TEMPLATE_VARIABLE_LENGTH } from '@/components/shared/settings/monaco-settings';

const eventService = RendererEventService.instance;

/**
 * Completion items provider for template variables in any text document.
 */
export class TemplateVariableCompletionItemsProvider implements languages.CompletionItemProvider {
  triggerCharacters = ['{'];

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
            position.column + MAX_TEMPLATE_VARIABLE_LENGTH,
            model.getLineMaxColumn(position.lineNumber)
          ),
        })
      );

      // create completion items for all variables
      for (const variable of await eventService.getActiveEnvironmentVariables()) {
        suggestions.push({
          label: variable.key,
          kind: variable.key.startsWith('$')
            ? languages.CompletionItemKind.Function
            : languages.CompletionItemKind.Variable,
          insertText: `${variable.key}}}`, // add variable name and closing bracket
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
