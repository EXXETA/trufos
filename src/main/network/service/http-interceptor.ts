import { Dispatcher, FormData, Response } from 'undici';
import fs from 'node:fs';
import { pipeline, Readable } from 'node:stream';
import { HistoryService } from 'main/history/history-service';
import { FileSystemService } from 'main/filesystem/filesystem-service';
import { ResponseBodyService } from 'main/network/service/response-body-service';
import type { HttpHeaders } from 'shim/headers';
import { StoredBody } from 'shim/history';
import { BodyRecorder } from './body-recorder';

const fileSystemService = FileSystemService.instance;
const responseBodyService = ResponseBodyService.instance;

type Body = Dispatcher.DispatchOptions['body'];

/**
 * Undici interceptor that records every request exactly as it is sent – resolved URL, headers and
 * body – in the {@link HistoryService}. The body is copied into a temporary file while it streams
 * to the server, so it is never held in memory. Requests sent outside of
 * {@link HistoryService.record} pass through untouched.
 */
export const httpInterceptor: Dispatcher.DispatcherComposeInterceptor =
  (dispatch) => (options, handler) => {
    const headers = normalizeHeaders(options.headers);
    const entry = HistoryService.instance.recordSentRequest({
      method: options.method,
      url: new URL(options.path, options.origin).href,
      headers,
    });
    if (entry?.request == null) return dispatch(options, handler);

    const { request } = entry;
    const body = recordBody(options.body, headers, (stored) => (request.body = stored));
    return dispatch({ ...options, body }, handler);
  };

/**
 * Copies the body into a temporary file registered in the {@link ResponseBodyService}.
 * @returns the body to send instead of the given one
 */
function recordBody(body: Body, headers: HttpHeaders, onStored: (body: StoredBody) => void): Body {
  if (body == null) return body;

  const file = fileSystemService.temporaryFile();
  const register = (size: number, bodyHeaders = headers) =>
    onStored({ id: responseBodyService.register(file.name, bodyHeaders), size });

  if (body instanceof Readable) {
    const recorder = new BodyRecorder(fs.createWriteStream('', { fd: file.fd }), register);
    // undici destroys the body it sends with the error if the request fails, e.g. because the
    // connection was refused. The pipeline handles that error, as undici reports it already, and
    // destroys the original body along with the recorder.
    pipeline(body, recorder, () => {});
    return recorder;
  }

  if (body instanceof FormData) {
    // undici serializes form data internally, after this point. Serialize a copy the same way;
    // it only differs from the sent bytes in the random multipart boundary.
    const multipart = new Response(body);
    const contentType = multipart.headers.get('content-type') ?? 'multipart/form-data';
    const copy = new BodyRecorder(fs.createWriteStream('', { fd: file.fd }), (size) =>
      register(size, { ...headers, 'content-type': contentType })
    );
    if (multipart.body != null) {
      pipeline(Readable.fromWeb(multipart.body), copy, (error) => {
        if (error != null) logger.warn('Could not record the form data body', error);
      });
    }
    return body;
  }

  const bytes = typeof body === 'string' ? Buffer.from(body) : body;
  fs.writeSync(file.fd, bytes);
  fs.closeSync(file.fd);
  register(bytes.byteLength);
  return body;
}

/** Brings the header formats undici accepts into one shape and drops unset headers. */
function normalizeHeaders(headers: Dispatcher.DispatchOptions['headers']): HttpHeaders {
  const result: HttpHeaders = {};
  if (headers == null) return result;

  const entries: [string, unknown][] = [];
  if (Array.isArray(headers)) {
    for (let i = 0; i + 1 < headers.length; i += 2) entries.push([headers[i], headers[i + 1]]);
  } else if (Symbol.iterator in headers) {
    entries.push(...headers);
  } else {
    entries.push(...Object.entries(headers));
  }

  for (const [key, value] of entries) {
    if (value == null) continue;
    result[key.toLowerCase()] = Array.isArray(value) ? value.map(String) : String(value);
  }
  return result;
}
