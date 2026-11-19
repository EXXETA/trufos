import { Readable } from 'node:stream';
import { buffer } from 'node:stream/consumers';
import { CollectionStateService } from 'main/collection-state/collection-state-service';
import { PersistenceService } from 'main/persistence/service/persistence-service';
import {
  AutomaticHeaderKey,
  CollectionModel,
  getDerivedHeaders,
  getSentHeaders,
  resolveAuthorization,
} from 'shim/collection-model';
import { DisplayableError } from 'shim/error/DisplayableError';
import { AuthorizationInformationNoInherit, AuthorizationType } from 'shim/objects/auth';
import { TrufosId } from 'shim/objects/id';
import { FormDataBody, RequestBody, RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { RequestMethod } from 'shim/objects/request-method';
import { buildUrl } from 'shim/objects/url';

/**
 * The largest text body that is copied into a cURL command, in bytes. The command is held in memory
 * and put on the clipboard, so larger bodies are refused.
 */
export const MAX_CURL_TEXT_BODY_SIZE = 1024 * 1024;

/**
 * The automatic headers that curl sets itself. If a request disables one of them, the command
 * blanks it out, so curl does not send it either.
 */
const CURL_DEFAULT_HEADERS = new Set([
  AutomaticHeaderKey.CONTENT_TYPE,
  AutomaticHeaderKey.USER_AGENT,
]);

/** Quotes a value for a POSIX shell: in single quotes, which cannot be escaped within them. */
export function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

/** Quotes a value inside a `-F` argument, so curl does not split it at `;` or `,`. */
function formQuote(value: string): string {
  return `"${value.replace(/[\\"]/g, '\\$&')}"`;
}

/** Returns the arguments of the fields of a form-data body. Inactive fields are left out. */
function getFormArguments({ fields }: FormDataBody): string[] {
  const args: string[] = [];
  for (const { key, isActive, value } of fields) {
    if (!isActive) continue;
    if (value.type === RequestBodyType.TEXT) {
      // unlike -F, --form-string does not read a file if the value starts with @ or <
      args.push(`--form-string ${shellQuote(`${key}=${value.text ?? ''}`)}`);
    } else if (value.filePath != null) {
      let field = `${key}=@${formQuote(value.filePath)}`;
      if (value.fileName != null) field += `;filename=${formQuote(value.fileName)}`;
      if (value.mimeType != null) field += `;type=${value.mimeType}`;
      args.push(`-F ${shellQuote(field)}`);
    }
  }
  return args;
}

/** Returns the arguments of a body. A text body without text is not sent. */
function getBodyArguments(body: RequestBody, textBody?: string): string[] {
  switch (body.type) {
    case RequestBodyType.NONE:
      return [];
    case RequestBodyType.TEXT:
      return textBody == null || textBody.length === 0
        ? []
        : [`--data-raw ${shellQuote(textBody)}`];
    case RequestBodyType.FILE:
      return body.filePath == null ? [] : [`--data-binary ${shellQuote(`@${body.filePath}`)}`];
    case RequestBodyType.FORM_DATA:
      return getFormArguments(body);
  }
}

/**
 * Returns how curl sends an authorization: as the value of the automatic Authorization header, as
 * arguments, or not at all, which a comment says.
 */
function getAuthorization(auth: AuthorizationInformationNoInherit): {
  header?: string;
  args: string[];
  comment?: string;
} {
  switch (auth.type) {
    case AuthorizationType.BEARER:
      return { header: `Bearer ${auth.token}`, args: [] };
    case AuthorizationType.BASIC:
      return { args: [`-u ${shellQuote(`${auth.username}:${auth.password}`)}`] };
    case AuthorizationType.DIGEST:
      return { args: [`--digest -u ${shellQuote(`${auth.username}:${auth.password}`)}`] };
    case AuthorizationType.OAUTH1:
      return { args: [], comment: 'The OAuth 1.0 authorization is not included.' };
    case AuthorizationType.OAUTH2:
      return { args: [], comment: 'The OAuth 2.0 authorization is not included.' };
  }
}

/**
 * Builds a cURL command that sends the request like Trufos does: with its own, inherited and
 * automatic headers, its authorization and its body. Variables are not resolved, so the command
 * does not contain the values of secret variables. A HEAD request is built without body, as curl
 * cannot send one with it.
 * @param model the model the request is taken from
 * @param request the request
 * @param textBody the content of the text body, if the request has one
 * @returns the command, with one argument per line
 */
export function buildCurlCommand(
  model: CollectionModel,
  request: TrufosRequest,
  textBody?: string
): string {
  const isHead = request.method === RequestMethod.HEAD;
  const bodyArgs = isHead ? [] : getBodyArguments(request.body, textBody);
  const auth = resolveAuthorization(model, request);
  const authorization = auth == null ? undefined : getAuthorization(auth);
  const { automatic, inherited } = getDerivedHeaders(model, request, {
    hasBody: bodyArgs.length > 0,
    authorization: authorization?.header,
  });

  const args = [
    `curl ${isHead ? '--head' : `-X ${request.method}`} ${shellQuote(buildUrl(request.url))}`,
  ];
  // headers without value are set by the HTTP client, curl sets them itself
  for (const { key, value } of getSentHeaders(automatic, inherited, request.headers)) {
    if (value != null) args.push(`-H ${shellQuote(`${key}: ${value}`)}`);
  }
  for (const { key, isDisabled, isOverridden } of automatic) {
    if (isDisabled && !isOverridden && CURL_DEFAULT_HEADERS.has(key)) {
      args.push(`-H ${shellQuote(`${key}:`)}`);
    }
  }

  // an own Authorization header replaces the authorization
  const sendsAuthorization = automatic.some(
    ({ key, isOverridden }) => key === AutomaticHeaderKey.AUTHORIZATION && !isOverridden
  );
  const sentAuthorization = sendsAuthorization ? authorization : undefined;
  args.push(...(sentAuthorization?.args ?? []), ...bodyArgs);

  const command = args.join(' \\\n  ');
  const comment = sentAuthorization?.comment;
  return comment == null ? command : `# ${comment}\n${command}`;
}

/** Reads a text body, unless it is larger than {@link MAX_CURL_TEXT_BODY_SIZE}. */
async function readTextBody(stream: Readable): Promise<string> {
  const content = await buffer(stream);
  if (content.length > MAX_CURL_TEXT_BODY_SIZE) {
    throw new DisplayableError(
      `The body of the request is larger than ${MAX_CURL_TEXT_BODY_SIZE / 1024 / 1024} MiB, ` +
        'which is too large to copy it as a cURL command.',
      'Body Too Large'
    );
  }
  return content.toString('utf-8');
}

/**
 * Builds a cURL command for a request of the open collection, see {@link buildCurlCommand}. Its
 * draft is used if it has one.
 * @param requestId the ID of the request
 * @throws if there is no such request, or its text body is too large
 */
export async function getRequestAsCurl(requestId: TrufosId): Promise<string> {
  const collectionState = CollectionStateService.instance;
  return await collectionState.readExistingRequest(requestId, async (request) => {
    // read on the queue, so the model matches the files
    const { model } = collectionState;
    // one byte more than allowed is enough to tell that the body is too large
    const stream = await PersistenceService.instance.loadTextBodyOfRequest(request, undefined, {
      end: MAX_CURL_TEXT_BODY_SIZE,
    });
    const textBody = stream == null ? undefined : await readTextBody(stream);
    return buildCurlCommand(model, request, textBody);
  });
}
