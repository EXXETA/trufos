import { RendererEventService } from '@/services/event/renderer-event-service';
import { TemplateVariableCompletionItemsProvider } from './template-variable-completion-items-provider';
import { VariableObject } from 'shim/variables';
import { IRange, languages, Position } from 'monaco-editor';
import { mockModel } from '@/__mocks__/monaco-util';
import { vi, describe, it, expect } from 'vitest';

vi.mock('@/services/event/renderer-event-service', () => ({
  RendererEventService: {
    instance: {
      getActiveEnvironmentVariables: vi.fn(),
    },
  },
}));

vi.mock('monaco-editor', () => ({
  languages: {
    CompletionItemKind: {
      Variable: 12,
      Function: 3,
    },
    CompletionTriggerKind: {
      TriggerCharacter: 2,
      Invoke: 3,
    },
  },
}));

const completionItemsProvider = new TemplateVariableCompletionItemsProvider();

describe('TemplateVariableCompletionItemsProvider', () => {
  // Arrange
  const variables: VariableObject[] = [
    { key: 'variable', value: '123' },
    { key: '$randomUuid', description: 'Description 2', value: '321' },
  ];
  vi.mocked(RendererEventService.instance.getActiveEnvironmentVariables).mockResolvedValue(
    variables
  );

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
    const { suggestions } = await completionItemsProvider.provideCompletionItems(model, position, {
      triggerKind: languages.CompletionTriggerKind.TriggerCharacter,
      triggerCharacter: '{',
    });

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
      endColumn: position.column,
    };

    // Act
    const { suggestions } = await completionItemsProvider.provideCompletionItems(model, position, {
      triggerKind: languages.CompletionTriggerKind.TriggerCharacter,
      triggerCharacter: '{',
    });

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
      endColumn: position.column,
    };

    // Act
    const { suggestions } = await completionItemsProvider.provideCompletionItems(model, position, {
      triggerKind: languages.CompletionTriggerKind.TriggerCharacter,
      triggerCharacter: '{',
    });

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
    const { suggestions } = await completionItemsProvider.provideCompletionItems(model, position, {
      triggerKind: languages.CompletionTriggerKind.TriggerCharacter,
      triggerCharacter: '{',
    });

    // Assert
    expect(suggestions).toHaveLength(0);
  });

  it('provides completion items for manual invocation at an existing template variable', async () => {
    // Arrange
    const model = mockModel({ value: `{{ word }} blah` });
    const position = { lineNumber: 2, column: 17 } as Position; // after 'w' in 'word'
    const expectedRange: IRange = {
      startLineNumber: position.lineNumber,
      startColumn: position.column - 1,
      endLineNumber: position.lineNumber,
      endColumn: position.column + 3,
    };

    // Act
    const { suggestions } = await completionItemsProvider.provideCompletionItems(model, position, {
      triggerKind: languages.CompletionTriggerKind.Invoke,
    });

    // Assert
    expect(suggestions).toHaveLength(variables.length);
    expect(suggestions[0].range).toEqual(expectedRange);
    expect(suggestions[0].insertText).toBe(variables[0].key);
  });

  it('provides completion items for manual invocation at an existing template variable without closing brackets', async () => {
    // Arrange
    const model = mockModel({ value: `{{ word blah` });
    const position = { lineNumber: 2, column: 16 } as Position; // before 'w' in 'word'
    const expectedRange: IRange = {
      startLineNumber: position.lineNumber,
      startColumn: position.column,
      endLineNumber: position.lineNumber,
      endColumn: position.column + 4, // 4 is the length of 'word'
    };

    // Act
    const { suggestions } = await completionItemsProvider.provideCompletionItems(model, position, {
      triggerKind: languages.CompletionTriggerKind.Invoke,
    });

    // Assert
    expect(suggestions).toHaveLength(variables.length);
    expect(suggestions[0].range).toEqual(expectedRange);
    expect(suggestions[0].insertText).toBe(variables[0].key + '}}');
  });
});
