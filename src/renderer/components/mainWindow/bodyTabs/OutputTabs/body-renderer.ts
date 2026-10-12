import type { FC } from 'react';
import type { editor } from 'monaco-editor';
import type { StoredBody } from 'shim/objects/response';

export interface BodyRendererProps {
  /** The body to show, or `undefined` if there is none. */
  body?: StoredBody;
  /** The MIME type of the body, if its headers declare one. */
  mimeType?: string;
  /** If set, only this many bytes of the body are shown. */
  maxBytes?: number;
}

export type BodyRenderer = FC<BodyRendererProps>;

export interface TextBodyRendererProps extends BodyRendererProps {
  /** The model the body is shown in. */
  model: editor.ITextModel;
  /** Whether the body is shown formatted, e.g. indented JSON. */
  format: boolean;
}

export type TextBodyRenderer = FC<TextBodyRendererProps>;
