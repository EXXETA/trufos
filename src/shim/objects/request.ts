import { AuthorizationInformation } from './auth';
import { RequestMethod } from './request-method';
import { TrufosURL } from './url';
import { TrufosHeader } from './headers';
import z from 'zod';

export const TEXT_BODY_FILE_NAME = 'request-body.txt';

export enum RequestBodyType {
  TEXT = 'text',
  FILE = 'file',
  FORM_DATA = 'form-data',
}

export const TextBody = z.object({
  type: z.literal(RequestBodyType.TEXT),
  /** The body content as a string. Used for importing from third party collections. Usually, this is only stored on the file system */
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
  data: z.record(z.string(), z.discriminatedUnion('type', [TextBody, FileBody])),
});
export type FormDataBody = z.infer<typeof FormDataBody>;

export const RequestBody = z.discriminatedUnion('type', [TextBody, FileBody, FormDataBody]);
export type RequestBody = z.infer<typeof RequestBody>;

export const TrufosRequest = z.object({
  id: z.string(),
  parentId: z.string(),
  type: z.literal('request'),
  title: z.string(),
  url: TrufosURL,
  method: z.enum(RequestMethod),
  headers: z.array(TrufosHeader),
  body: RequestBody,
  draft: z.boolean().optional(),
  auth: AuthorizationInformation.optional(),
});
export type TrufosRequest = z.infer<typeof TrufosRequest>;
