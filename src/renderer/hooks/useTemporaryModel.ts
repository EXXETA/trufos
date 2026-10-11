import { useEffect, useState } from 'react';
import { editor } from 'monaco-editor';

/**
 * Creates an editor model that is disposed with the component, e.g. to show a body that does not
 * belong to a request, so showing many of them does not leak models.
 */
export const useTemporaryModel = (): editor.ITextModel => {
  const [model] = useState(() => editor.createModel(''));
  useEffect(() => () => model.dispose(), [model]);
  return model;
};
