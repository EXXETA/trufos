import { RendererEventService } from '@/services/event/renderer-event-service';
import { TemplateVariableCompletionItemsProvider } from '@/lib/monaco/TemplateVariableCompletionItemsProvider';
import { VariableObject } from 'shim/variables';
import { editor, IRange, languages, Position } from 'monaco-editor';

jest.mock('@/services/event/renderer-event-service', () => ({
  RendererEventService: {
    instance: {
      getActiveEnvironmentVariables: jest.fn(),
    },
  },
}));

jest.mock('monaco-editor', () => ({
  languages: {
    CompletionItemKind: {
      Variable: 12,
      Function: 3,
    },
  },
}));

const completionItemsProvider = new TemplateVariableCompletionItemsProvider();

function mockModel(json: object) {
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
  } as editor.ITextModel;
}

describe('TemplateVariableCompletionItemsProvider', () => {
  // Arrange
  const variables: VariableObject[] = [
    { key: 'variable', value: '123', enabled: true },
    { key: '$randomUuid', description: 'Description 2', value: '321', enabled: true },
  ];
  jest
    .mocked(RendererEventService.instance.getActiveEnvironmentVariables)
    .mockResolvedValue(variables);

  it("provides completion items if the current position is directly after '{{'", async () => {
    // Arrange
    const model = mockModel({
      some: 321,
      value: `{{this is untouched`,
    });
    const position = { lineNumber: 3, column: 15 } as Position;
    const expectedRange: IRange = {
      startLineNumber: position.lineNumber,
      startColumn: position.column,
      endLineNumber: position.lineNumber,
      endColumn: position.column,
    };

    // Act
    const { suggestions } = await completionItemsProvider.provideCompletionItems(model, position);

    // Assert
    expect(suggestions).toHaveLength(variables.length);
    expect(suggestions[0].label).toBe(variables[0].key);
    expect(suggestions[0].kind).toBe(languages.CompletionItemKind.Variable);
    expect(suggestions[0].insertText).toBe(`${variables[0].key}}}`);
    expect(suggestions[0].range).toEqual(expectedRange);

    expect(suggestions[1].label).toBe(variables[1].key);
    expect(suggestions[1].kind).toBe(languages.CompletionItemKind.Function);
    expect(suggestions[1].insertText).toBe(`${variables[1].key}}}`);
    expect(suggestions[1].range).toEqual(expectedRange);
  });

  it("provides completion items if the current position is directly after '{{' and before '}}'", async () => {
    // Arrange
    const model = mockModel({ value: `{{}} nonsense` });
    const position = { lineNumber: 2, column: 15 } as Position;
    const expectedRange: IRange = {
      startLineNumber: position.lineNumber,
      startColumn: position.column,
      endLineNumber: position.lineNumber,
      endColumn: position.column + 2, // + 2 for '}}'
    };

    // Act
    const { suggestions } = await completionItemsProvider.provideCompletionItems(model, position);

    // Assert
    expect(suggestions).toHaveLength(variables.length);
    expect(suggestions[0].range).toEqual(expectedRange);
  });

  it("provides completion items if the current position is directly after '{{' and before '}}' having spaces", async () => {
    // Arrange
    const model = mockModel({ value: `{{  }} test` });
    const position = { lineNumber: 2, column: 15 } as Position;
    const expectedRange: IRange = {
      startLineNumber: position.lineNumber,
      startColumn: position.column,
      endLineNumber: position.lineNumber,
      endColumn: position.column + 4, // + 2 spaces + 2 brackets
    };

    // Act
    const { suggestions } = await completionItemsProvider.provideCompletionItems(model, position);

    // Assert
    expect(suggestions).toHaveLength(variables.length);
    expect(suggestions[0].range).toEqual(expectedRange);
  });

  it("does not provide completion items if the current position is not directly after '{{'", async () => {
    // Arrange
    const model = mockModel({
      some: 321,
      value: `{}`,
    });
    const position = { lineNumber: 3, column: 14 } as Position;

    // Act
    const { suggestions } = await completionItemsProvider.provideCompletionItems(model, position);

    // Assert
    expect(suggestions).toHaveLength(0);
  });
});
