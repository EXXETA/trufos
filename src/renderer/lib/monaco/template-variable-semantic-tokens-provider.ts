import { editor, languages } from 'monaco-editor';
import { TokenArray } from '@/lib/monaco/token';

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
    const tokens = new TokenArray();

    for (let i = 0; i < model.getLineCount(); i++) {
      this.regex.lastIndex = 0; // reset regex
      for (let match; (match = this.regex.exec(model.getLineContent(i + 1))) !== null; ) {
        tokens.push({
          lineNumber: i,
          column: match.index,
          length: match[0].length,
          type: 0, // variable.template
          modifiers: [], // no modifiers
        });
      }
    }

    return {
      data: tokens.toUint32Array(),
    };
  }

  releaseDocumentSemanticTokens(resultId?: string) {
    // no-op
  }
}
