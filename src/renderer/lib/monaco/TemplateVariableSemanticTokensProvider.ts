import { editor, languages } from 'monaco-editor';

/**
 * Semantic tokens provider for template variables in any text document.
 */
export class TemplateVariableSemanticTokensProvider
  implements languages.DocumentSemanticTokensProvider
{
  private readonly regex = /\{\{\s*(\$?\w+)\s*}}/g;

  getLegend(): languages.SemanticTokensLegend {
    return {
      tokenTypes: ['variable.template'],
      tokenModifiers: [],
    };
  }

  provideDocumentSemanticTokens(
    model: editor.ITextModel
  ): languages.ProviderResult<languages.SemanticTokens | languages.SemanticTokensEdits> {
    const tokens: number[] = [];

    for (let i = 0; i < model.getLineCount(); i++) {
      this.regex.lastIndex = 0; // reset regex
      for (let match; (match = this.regex.exec(model.getLineContent(i + 1))) !== null; ) {
        tokens.push(
          i, // line index (0-based)
          match.index, // start column (0-based)
          match[0].length, // token length
          0, // token type index
          0 // no modifiers
        );
      }
    }

    return {
      data: new Uint32Array(tokens),
    };
  }

  releaseDocumentSemanticTokens(resultId?: string) {
    // no-op
  }
}
