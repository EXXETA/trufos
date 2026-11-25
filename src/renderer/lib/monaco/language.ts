import { languages, typescript } from 'monaco-editor';
import xmlFormat from 'xml-formatter';
import { Language } from './languages';
import { TemplateVariableCompletionItemsProvider } from './template-variable-completion-items-provider';
import { TemplateVariableHoverProvider } from './template-variable-hover-provider';
import { TemplateVariableSemanticTokensProvider } from './template-variable-semantic-tokens-provider';
import trufosDeclaration from '@/assets/trufos-scripting-api.d.ts?raw';

typescript.javascriptDefaults.addExtraLib(trufosDeclaration);

// Re-export the pure helpers so existing imports keep working; they live in
// `./languages`, which has no side effects and can be imported by tests.
export {
  Language,
  languageToMimeType,
  mimeTypeEssence,
  mimeTypeToLanguage,
  isFormattableLanguage,
} from './languages';

const supportedLanguages = [Language.JSON, Language.XML, Language.TEXT];

// plaintext using fast syntax highlighting
languages.setMonarchTokensProvider(Language.TEXT, {
  tokenizer: {
    root: [[/\{\{\s*(\$?\w+)\s*}}/, 'variable.template']],
  },
});

// other rich languages using semantic tokens
languages.registerDocumentSemanticTokensProvider(
  supportedLanguages.filter((lang) => lang !== Language.TEXT),
  new TemplateVariableSemanticTokensProvider()
);

// completion items provider (suggests template variables)
languages.registerCompletionItemProvider(
  supportedLanguages,
  new TemplateVariableCompletionItemsProvider()
);

// hover provider (shows template variable value on hover)
languages.registerHoverProvider(supportedLanguages, new TemplateVariableHoverProvider());

// XML formatting provider
languages.registerDocumentFormattingEditProvider(Language.XML, {
  provideDocumentFormattingEdits: (model) => {
    const text = model.getValue();
    const formattedText = xmlFormat(text);
    return [
      {
        range: model.getFullModelRange(),
        text: formattedText,
      },
    ];
  },
});
