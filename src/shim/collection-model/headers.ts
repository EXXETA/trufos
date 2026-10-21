import { isSentHeader, normalizeHeaderKey, TrufosHeader } from '../objects/headers';
import { RequestBody, RequestBodyType, TrufosRequest } from '../objects/request';
import {
  CollectionInfo,
  CollectionModel,
  FolderInfo,
  getInheritanceChain,
  resolveAuthorization,
} from './model';

/*
 * The headers a request sends: the automatic ones that Trufos sets itself, the ones it inherits from
 * the collection and its folders, and its own ones. A closer level replaces all headers with the
 * same key of the levels before it: inherited headers replace automatic ones, own headers replace
 * both.
 *
 * A request can disable automatic and inherited headers by their key: then neither an automatic nor
 * an inherited header with that key is sent. The automatic headers that other settings control
 * cannot be disabled this way, e.g. the authorization is chosen in the Auth tab. Disabling an
 * inherited header with its key sends the automatic one instead.
 *
 * The values of automatic headers are final. Variables are only resolved in inherited and own ones.
 */

/** The content type of file bodies whose mime type is unknown. */
export const DEFAULT_FILE_MIME_TYPE = 'application/octet-stream';

/** A header that a request or folder inherits from the collection or a folder above it. */
export interface InheritedHeader {
  header: TrufosHeader;
  /** Where the header is defined. */
  source: CollectionInfo | FolderInfo;
  /** Whether the inheriting request or folder has a sent header with the same key. */
  isOverridden: boolean;
  /** Whether the inheriting request does not send the header. */
  isDisabled: boolean;
}

/** A request or folder that inherits headers. */
export interface HeaderInheritingNode {
  parentId: string;
  headers?: TrufosHeader[];
  disabledHeaders?: string[];
}

/** The headers that Trufos sets itself, by their normalized key. */
export enum AutomaticHeaderKey {
  CONTENT_TYPE = 'content-type',
  CONTENT_LENGTH = 'content-length',
  AUTHORIZATION = 'authorization',
  USER_AGENT = 'user-agent',
}

/** A header that Trufos sets itself, unless the request disables it or sends another one instead. */
export interface AutomaticHeader {
  key: AutomaticHeaderKey;
  /**
   * The value, or undefined if it is not known yet. A header that has no value when the request is
   * sent is set by the HTTP client, e.g. the content type of form data, which includes its boundary.
   */
  value?: string;
  /** Whether the request can disable the header. */
  canDisable: boolean;
  /**
   * Whether the header is only sent if the body is not empty, which is only known when the request
   * is sent.
   */
  isConditional: boolean;
  /** Whether an inherited or own header with the same key is sent instead. */
  isOverridden: boolean;
  /** Whether the request does not send the header. */
  isDisabled: boolean;
}

/** What is known about the automatic headers only when a request is sent. */
export interface AutomaticHeaderValues {
  authorization?: string;
  contentLength?: string;
  userAgent?: string;
  /**
   * Whether the request has a body to send. Undefined if it is not known yet. A text body without
   * text is not sent, nor is its content type.
   */
  hasBody?: boolean;
}

/** A header as it is sent. A header without value is set by the HTTP client. */
export interface SentHeader {
  key: string;
  value?: string;
  /** Whether Trufos sets the header itself. Its value is final, no variables are resolved in it. */
  isAutomatic: boolean;
}

/** Returns the normalized keys of the given headers. */
function getKeys(headers: Pick<SentHeader, 'key'>[]): Set<string> {
  return new Set(headers.map(({ key }) => normalizeHeaderKey(key)));
}

/** Returns whether an automatic or inherited header is sent, i.e. neither overridden nor disabled. */
function isSentDerivedHeader({ isOverridden, isDisabled }: AutomaticHeader | InheritedHeader) {
  return !isOverridden && !isDisabled;
}

/** Returns the keys of the inherited and own headers that are sent, which override automatic ones. */
function getSentKeys(inherited: InheritedHeader[], own: TrufosHeader[]): Set<string> {
  return getKeys([
    ...inherited.filter(isSentDerivedHeader).map(({ header }) => header),
    ...own.filter(isSentHeader),
  ]);
}

/**
 * Returns the headers a request or folder inherits: the sent headers of the collection and of every
 * folder above it. The headers of a closer level replace all headers with the same key of the outer
 * levels.
 * @param model the collection and its folders
 * @param node the inheriting request or folder
 * @returns the inherited headers, those of the outermost level first
 */
export function getInheritedHeaders(
  model: Pick<CollectionModel, 'collection' | 'folders'>,
  node: HeaderInheritingNode
): InheritedHeader[] {
  let inherited: Omit<InheritedHeader, 'isOverridden' | 'isDisabled'>[] = [];
  for (const source of getInheritanceChain(model, node.parentId).toReversed()) {
    const sent = (source.headers ?? []).filter(isSentHeader);
    const innerKeys = getKeys(sent);
    inherited = inherited
      .filter(({ header }) => !innerKeys.has(normalizeHeaderKey(header.key)))
      .concat(sent.map((header) => ({ header, source })));
  }

  const ownKeys = getKeys((node.headers ?? []).filter(isSentHeader));
  const disabledKeys = new Set(node.disabledHeaders);
  return inherited.map((entry) => {
    const key = normalizeHeaderKey(entry.header.key);
    return { ...entry, isOverridden: ownKeys.has(key), isDisabled: disabledKeys.has(key) };
  });
}

/** Returns the content type that is sent for a body, if any. */
function getContentType(
  body: RequestBody,
  { hasBody }: AutomaticHeaderValues
): Pick<AutomaticHeader, 'value' | 'canDisable' | 'isConditional'> | undefined {
  if (hasBody === false) return;
  switch (body.type) {
    case RequestBodyType.NONE:
      return;
    case RequestBodyType.TEXT:
      return { value: body.mimeType, canDisable: true, isConditional: hasBody == null };
    case RequestBodyType.FILE:
      if (body.filePath == null) return;
      return {
        value: body.mimeType ?? DEFAULT_FILE_MIME_TYPE,
        canDisable: true,
        isConditional: false,
      };
    case RequestBodyType.FORM_DATA:
      // the HTTP client sets it including the boundary, even if the request does not
      return { canDisable: false, isConditional: false };
  }
}

/**
 * Returns the headers that Trufos sets itself for a request.
 * @param model the collection and its folders
 * @param request the request
 * @param inherited the headers the request inherits, see {@link getInheritedHeaders}
 * @param values what is known about the headers only when the request is sent
 */
export function getAutomaticHeaders(
  model: Pick<CollectionModel, 'collection' | 'folders'>,
  request: HeaderInheritingNode & Pick<TrufosRequest, 'body' | 'auth'>,
  inherited: InheritedHeader[],
  values: AutomaticHeaderValues = {}
): AutomaticHeader[] {
  const automatic: Omit<AutomaticHeader, 'isOverridden' | 'isDisabled'>[] = [];
  const contentType = getContentType(request.body, values);
  if (contentType != null) automatic.push({ key: AutomaticHeaderKey.CONTENT_TYPE, ...contentType });
  if (request.body.type === RequestBodyType.FILE && request.body.filePath != null) {
    automatic.push({
      key: AutomaticHeaderKey.CONTENT_LENGTH,
      value: values.contentLength,
      canDisable: false,
      isConditional: false,
    });
  }
  if (resolveAuthorization(model, request) != null) {
    // disabled by choosing no authorization
    automatic.push({
      key: AutomaticHeaderKey.AUTHORIZATION,
      value: values.authorization,
      canDisable: false,
      isConditional: false,
    });
  }
  automatic.push({
    key: AutomaticHeaderKey.USER_AGENT,
    value: values.userAgent,
    canDisable: true,
    isConditional: false,
  });

  const overridingKeys = getSentKeys(inherited, request.headers ?? []);
  const disabledKeys = new Set(request.disabledHeaders);
  return automatic.map((header) => ({
    ...header,
    isOverridden: overridingKeys.has(header.key),
    isDisabled: header.canDisable && disabledKeys.has(header.key),
  }));
}

/**
 * Returns the headers that are sent: the automatic and the inherited ones that are neither disabled
 * nor overridden, followed by the own sent ones.
 * @param automatic the automatic headers, see {@link getAutomaticHeaders}
 * @param inherited the inherited headers, see {@link getInheritedHeaders}
 * @param own the own headers of the request
 */
export function getSentHeaders(
  automatic: AutomaticHeader[],
  inherited: InheritedHeader[],
  own: TrufosHeader[]
): SentHeader[] {
  return [
    ...automatic
      .filter(isSentDerivedHeader)
      .map(({ key, value }) => ({ key, value, isAutomatic: true })),
    ...inherited
      .filter(isSentDerivedHeader)
      .map(({ header: { key, value } }) => ({ key, value, isAutomatic: false })),
    ...own.filter(isSentHeader).map(({ key, value }) => ({ key, value, isAutomatic: false })),
  ];
}

/** The headers a request sends without defining them itself. */
export interface DerivedHeaders {
  inherited: InheritedHeader[];
  automatic: AutomaticHeader[];
}

/**
 * Returns the inherited and the automatic headers of a request, see {@link getInheritedHeaders}
 * and {@link getAutomaticHeaders}.
 * @param model the collection and its folders
 * @param request the request
 * @param values what is known about the automatic headers only when the request is sent
 */
export function getDerivedHeaders(
  model: Pick<CollectionModel, 'collection' | 'folders'>,
  request: Pick<TrufosRequest, 'parentId' | 'headers' | 'disabledHeaders' | 'body' | 'auth'>,
  values: AutomaticHeaderValues = {}
): DerivedHeaders {
  const inherited = getInheritedHeaders(model, request);
  return { inherited, automatic: getAutomaticHeaders(model, request, inherited, values) };
}

/**
 * Returns the headers that are sent with a request, see {@link getSentHeaders}.
 * @param model the collection and its folders
 * @param request the request
 * @param values what is known about the automatic headers only when the request is sent
 */
export function resolveHeaders(
  model: Pick<CollectionModel, 'collection' | 'folders'>,
  request: Pick<TrufosRequest, 'parentId' | 'headers' | 'disabledHeaders' | 'body' | 'auth'>,
  values: AutomaticHeaderValues = {}
): SentHeader[] {
  const { inherited, automatic } = getDerivedHeaders(model, request, values);
  return getSentHeaders(automatic, inherited, request.headers);
}
