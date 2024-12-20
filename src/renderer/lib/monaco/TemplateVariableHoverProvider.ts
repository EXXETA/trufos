import { editor, languages, Position, Range } from 'monaco-editor';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { MAX_TEMPLATE_VARIABLE_LENGTH } from '@/components/shared/settings/monaco-settings';

const eventService = RendererEventService.instance;

export class TemplateVariableHoverProvider implements languages.HoverProvider {
  async provideHover(
    model: editor.ITextModel,
    position: Position
  ): Promise<languages.Hover | null> {
    let wordInfo = model.getWordAtPosition(position);
    if (wordInfo === null || wordInfo.startColumn < 3) {
      return null;
    }
    if (
      model.getValueInRange(
        new Range(
          position.lineNumber,
          wordInfo.startColumn - 1,
          position.lineNumber,
          wordInfo.startColumn
        )
      ) === '$'
    ) {
      wordInfo = {
        word: '$' + wordInfo.word,
        startColumn: wordInfo.startColumn - 1,
        endColumn: wordInfo.endColumn,
      };
    }

    // limit search to a certain range around the variable for performance reasons
    const prefix = model.getValueInRange(
      new Range(
        position.lineNumber,
        Math.max(1, wordInfo.startColumn - MAX_TEMPLATE_VARIABLE_LENGTH),
        position.lineNumber,
        wordInfo.startColumn
      )
    );
    const postfix = model.getValueInRange(
      new Range(
        position.lineNumber,
        wordInfo.endColumn,
        position.lineNumber,
        Math.min(
          model.getLineMaxColumn(position.lineNumber),
          wordInfo.endColumn + MAX_TEMPLATE_VARIABLE_LENGTH
        )
      )
    );

    // check if the variable is a template variable
    const variableName = wordInfo.word;
    if (/\{\{\s*$/.test(prefix) && /^\s*}}/.test(postfix) && /^\$?\w+$/.test(variableName)) {
      const variable = await eventService.getVariable(variableName);
      const description: string[] = [];
      if (variable == null) {
        description.push(`Template variable \`${variableName}\` not found.`);
      } else {
        description.push(variable.description ?? 'A custom variable set by you.');
        description.push(`**Current value:** \`${variable.value}\``);
      }

      return {
        range: new Range(
          position.lineNumber,
          wordInfo.startColumn,
          position.lineNumber,
          wordInfo.endColumn
        ),
        contents: description.map((line) => ({ value: line })),
      };
    }

    return null;
  }
}
