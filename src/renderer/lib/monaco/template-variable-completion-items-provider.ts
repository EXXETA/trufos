import { editor, IRange, languages, Position } from 'monaco-editor';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { MAX_TEMPLATE_VARIABLE_LENGTH } from '@/components/shared/settings/monaco-settings';
import CompletionTriggerKind = languages.CompletionTriggerKind;

const eventService = RendererEventService.instance;

/**
 * Completion items provider for template variables in any text document.
 */
export class TemplateVariableCompletionItemsProvider implements languages.CompletionItemProvider {
  triggerCharacters = ['{'];

  async provideCompletionItems(
    model: editor.ITextModel,
    position: Position,
    context: languages.CompletionContext
  ): Promise<languages.CompletionList> {
    return {
      suggestions:
        context.triggerKind === CompletionTriggerKind.Invoke
          ? await this.getManualSuggestions(model, position)
          : await this.getAutomaticSuggestions(model, position),
    };
  }

  /**
   * Get suggestions for active variables using the given range.
   * @param range The range in the editor which the suggestions should be inserted.
   * @param withClosingBracket OPTIONAL: Whether to add the closing brackets to the suggestion.
   */
  private async getSuggestions(range: IRange, withClosingBracket = true) {
    const suggestions: languages.CompletionItem[] = [];

    for (const [key, variable] of await eventService.getActiveEnvironmentVariables()) {
      const postfix = withClosingBracket ? '}}' : '';
      suggestions.push({
        label: key,
        kind: key.startsWith('$')
          ? languages.CompletionItemKind.Function
          : languages.CompletionItemKind.Variable,
        insertText: `${key}${postfix}`, // add variable name and optionally closing bracket
        range,
        detail: variable.description,
      });
    }

    return suggestions;
  }

  private async getAutomaticSuggestions(model: editor.ITextModel, position: Position) {
    if (
      position.column < 3 ||
      model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: position.column - 2,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      }) !== '{{'
    ) {
      return [];
    }

    // check if there is are closing brackets after the opening brackets
    const hasClosingBrackets = /^\s*}}/.test(
      model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: position.column,
        endLineNumber: position.lineNumber,
        endColumn: Math.min(
          position.column + MAX_TEMPLATE_VARIABLE_LENGTH,
          model.getLineMaxColumn(position.lineNumber)
        ),
      })
    );

    return await this.getSuggestions(
      {
        startLineNumber: position.lineNumber,
        startColumn: position.column,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      },
      !hasClosingBrackets
    );
  }

  private async getManualSuggestions(model: editor.ITextModel, position: Position) {
    const wordInfo = model.getWordAtPosition(position);
    if (wordInfo === null || wordInfo.startColumn < 3) {
      return await this.getAutomaticSuggestions(model, position);
    }

    // allow variables to start with a dollar sign
    let { word, startColumn } = wordInfo;
    if (
      model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: startColumn - 1,
        endLineNumber: position.lineNumber,
        endColumn: startColumn,
      }) === '$'
    ) {
      word = '$' + word;
      startColumn--;
    }

    // check if there is an opening bracket before the word
    if (
      !/\{\{\s*$/.test(
        model.getValueInRange({
          startLineNumber: position.lineNumber,
          // limit search to a certain range around the word for performance reasons
          startColumn: Math.max(1, startColumn - MAX_TEMPLATE_VARIABLE_LENGTH + word.length),
          endLineNumber: position.lineNumber,
          endColumn: startColumn,
        })
      )
    ) {
      return [];
    }

    // check if there are closing brackets after the word
    const hasClosingBrackets = /^\s*}}/.test(
      model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: wordInfo.endColumn,
        endLineNumber: position.lineNumber,
        endColumn: Math.min(
          model.getLineMaxColumn(position.lineNumber),
          wordInfo.endColumn + MAX_TEMPLATE_VARIABLE_LENGTH - word.length
        ),
      })
    );

    // we do not need to filter for the given word, monaco does this for us
    return await this.getSuggestions(
      {
        startLineNumber: position.lineNumber,
        startColumn: startColumn,
        endLineNumber: position.lineNumber,
        endColumn: wordInfo.endColumn,
      },
      !hasClosingBrackets
    );
  }
}
