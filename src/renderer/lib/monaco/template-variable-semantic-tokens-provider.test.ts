import { mockModel } from '@/__mocks__/monaco-util';
import { TemplateVariableSemanticTokensProvider } from '@/lib/monaco/template-variable-semantic-tokens-provider';
import { describe, it, expect } from 'vitest';

const semanticTokensProvider = new TemplateVariableSemanticTokensProvider();

describe('TemplateVariableSemanticTokensProvider', () => {
  it('should provide semantic tokens for template variables', () => {
    // Arrange
    const template = '{{variable}}';
    const model = mockModel({ first: template, second: template });

    // Act
    const result = semanticTokensProvider.provideDocumentSemanticTokens(model);

    // Assert
    expect(result).toEqual({
      data: new Uint32Array([
        1, // first line + 1
        12,
        template.length,
        0,
        0,
        1, // second line + 1
        13,
        template.length,
        0,
        0,
      ]),
    });
  });
});
