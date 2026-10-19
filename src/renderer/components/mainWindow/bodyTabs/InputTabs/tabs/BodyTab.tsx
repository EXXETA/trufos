import { ReactElement, ReactNode, RefObject, useCallback, useRef } from 'react';
import { SimpleSelect } from '@/components/mainWindow/bodyTabs/InputTabs/SimpleSelect';
import { RequestBody, RequestBodyType, TextBody } from 'shim/objects/request';
import { Divider } from '@/components/shared/Divider';
import {
  isFormattableLanguage,
  Language,
  languageToMimeType,
  mimeTypeToLanguage,
} from '@/lib/monaco/language';
import { selectRequest, useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import BodyTabFileInput from './BodyTabFileInput';
import BodyTabTextInput from './BodyTabTextInput';
import { FormDataTab } from './FormDataTab';
import { Button } from '@/components/ui/button';
import { WandSparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { editor } from 'monaco-editor';

/** The label and the initial body of each body type. They are offered in the order of the enum. */
const BODY_TYPES: {
  [T in RequestBodyType]: { label: string; create: () => Extract<RequestBody, { type: T }> };
} = {
  [RequestBodyType.NONE]: { label: 'None', create: () => ({ type: RequestBodyType.NONE }) },
  [RequestBodyType.TEXT]: {
    label: 'Text',
    create: () => ({ type: RequestBodyType.TEXT, mimeType: 'text/plain' }),
  },
  [RequestBodyType.FILE]: { label: 'File', create: () => ({ type: RequestBodyType.FILE }) },
  [RequestBodyType.FORM_DATA]: {
    label: 'Form Data',
    create: () => ({ type: RequestBodyType.FORM_DATA, fields: [] }),
  },
};

const BODY_TYPE_ITEMS = Object.values(RequestBodyType).map((type): [RequestBodyType, string] => [
  type,
  BODY_TYPES[type].label,
]);

/** The parts of the body tab that depend on the type of the body. */
interface BodyEditorParts {
  /** Controls next to the body type select. */
  toolbar?: ReactNode;
  /** Controls on the right of the toolbar. */
  actions?: ReactNode;
  content: ReactNode;
}

interface TextBodyContext {
  editorRef: RefObject<editor.ICodeEditor | undefined>;
  setMimeType: (mimeType: string) => void;
  format: () => void;
}

function textBodyParts(
  body: TextBody,
  { editorRef, setMimeType, format }: TextBodyContext
): BodyEditorParts {
  const language = mimeTypeToLanguage(body.mimeType);
  const canFormat = isFormattableLanguage(language);
  return {
    toolbar: (
      <SimpleSelect<Language>
        value={language}
        onValueChange={(language) => setMimeType(languageToMimeType(language))}
        items={[
          [Language.JSON, 'JSON'],
          [Language.XML, 'XML'],
          [Language.TEXT, 'Plain'],
        ]}
      />
    ),
    actions: (
      <Button
        className={cn('h-6 gap-2', { 'opacity-50': !canFormat })}
        size="sm"
        variant="ghost"
        onClick={format}
        disabled={!canFormat}
      >
        <WandSparkles size={16} />
        Format
      </Button>
    ),
    content: (
      <BodyTabTextInput
        className="pr-4"
        language={language}
        onMount={(editorInstance) => {
          editorRef.current = editorInstance;
        }}
      />
    ),
  };
}

function bodyEditorParts(body: RequestBody, text: TextBodyContext): BodyEditorParts {
  switch (body.type) {
    case RequestBodyType.NONE:
      return {
        content: (
          <p className="text-text-secondary px-6 text-sm">This request does not have a body.</p>
        ),
      };
    case RequestBodyType.TEXT:
      return textBodyParts(body, text);
    case RequestBodyType.FILE:
      return { content: <BodyTabFileInput className="px-4 pb-2" /> };
    case RequestBodyType.FORM_DATA:
      return { content: <FormDataTab /> };
  }
}

export const BodyTab = (): ReactElement => {
  const { setRequestBody, setRequestBodyMimeType } = useCollectionActions();
  const editorRef = useRef<editor.ICodeEditor | undefined>(undefined);
  const body = useCollectionStore((state) => selectRequest(state)!.body);

  const format = useCallback(async () => {
    await editorRef.current?.getAction('editor.action.formatDocument')?.run();
  }, []);

  const { toolbar, actions, content } = bodyEditorParts(body, {
    editorRef,
    setMimeType: setRequestBodyMimeType,
    format,
  });

  // the type select keeps its place in the tree, so it keeps the focus when the body type changes
  return (
    <div className="flex h-full flex-col gap-4">
      <div className="space-y-2 px-4 pt-2">
        <div className="flex justify-between px-2">
          <div className="flex items-center gap-2 px-2">
            <SimpleSelect<RequestBodyType>
              value={body.type}
              onValueChange={(type) => setRequestBody(BODY_TYPES[type].create())}
              items={BODY_TYPE_ITEMS}
            />
            {toolbar}
          </div>
          {actions}
        </div>
        <Divider />
      </div>
      {content}
    </div>
  );
};
