import { Language } from '@/lib/monaco/language';
import { Editor, EditorProps, Monaco } from '@monaco-editor/react';
import { useCallback } from 'react';
import xmlFormat from 'xml-formatter';

export default function MonacoEditor(props: EditorProps) {
  const handleBeforeMount = useCallback((monacoInstance: Monaco) => {
    monacoInstance.languages.registerDocumentFormattingEditProvider(Language.XML, {
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
  }, []);

  return <Editor {...props} beforeMount={handleBeforeMount} />;
}
