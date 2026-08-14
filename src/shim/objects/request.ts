import { AuthorizationInformation } from './auth';
import { RequestMethod } from './request-method';
import { TrufosURL } from './url';
import { TrufosHeader } from './headers';
import { z } from 'zod';

export const TEXT_BODY_FILE_NAME = 'request-body.txt';

export enum RequestBodyType {
  TEXT = 'text',
  FILE = 'file',
  FORM_DATA = 'form-data',
}

export const TextBody = z.object({
  type: z.literal(RequestBodyType.TEXT),
  /** The body content as a string. Used for form data content or importing from third party collections. Usually, this is only stored on the file system */
  text: z.string().optional(),
  /** The mime type of the file content, e.g. "application/json". May include an encoding */
  mimeType: z.string(),
});
export type TextBody = z.infer<typeof TextBody>;

export const FileBody = z.object({
  type: z.literal(RequestBodyType.FILE),
  filePath: z.string().optional(),
  fileName: z.string().optional(),
  /** The mime type of the file content, e.g. "application/json". May include an encoding */
  mimeType: z.string().optional(),
});
export type FileBody = z.infer<typeof FileBody>;

export enum FormDataValueType {
  TEXT = 'text',
  FILE = 'file',
}

export const FormDataBody = z.object({
  type: z.literal(RequestBodyType.FORM_DATA),
  fields: z.array(
    z.object({
      key: z.string(),
      isActive: z.boolean(),
      value: z.discriminatedUnion('type', [TextBody, FileBody]),
    })
  ),
});
export type FormDataBody = z.infer<typeof FormDataBody>;

export const RequestBody = z.discriminatedUnion('type', [TextBody, FileBody, FormDataBody]);
export type RequestBody = z.infer<typeof RequestBody>;

/**
 * Returns the text body that a request carries inline instead of in its body file. Producers that
 * never touch the file system deliver the body this way: importers, the default collection, and
 * info files written by older versions. Once saved, the body file is the canonical form.
 * @param request the request to read the inline body of
 * @returns the inline text body, or undefined if the request has none
 */
export function getInlineTextBody(request: TrufosRequest) {
  return request.body.type === RequestBodyType.TEXT ? request.body.text : undefined;
}

/**
 * Like {@link getInlineTextBody}, but also clears the inline body, because it is a one-shot
 * transport field: it must not survive the save that consumes it, or it would go stale and
 * shadow the body file.
 * @param request the request to take the inline body from
 * @returns the inline text body, or undefined if the request has none
 */
export function takeInlineTextBody(request: TrufosRequest) {
  const text = getInlineTextBody(request);
  if (request.body.type === RequestBodyType.TEXT) delete request.body.text;
  return text;
}

export const TrufosRequest = z.object({
  id: z.string(),
  parentId: z.string(),
  type: z.literal('request'),
  lastModified: z.number(),
  title: z.string(),
  url: TrufosURL,
  method: z.enum(RequestMethod),
  headers: z.array(TrufosHeader),
  body: RequestBody,
  draft: z.boolean().optional(),
  auth: AuthorizationInformation.optional(),
});
export type TrufosRequest = z.infer<typeof TrufosRequest>;
