import { pipeline, Readable } from 'node:stream';
import { finished } from 'node:stream/promises';
import { FormData, Response } from 'undici';
import { BodyStore } from 'main/network/service/body-store';
import type { HttpHeaders } from 'shim/headers';
import { BodyRecorder } from './body-recorder';

const bodyStore = BodyStore.instance;

/** The bodies `HttpService` sends. */
export type RequestBody = Readable | FormData | undefined;

/** A copy of a request body in the {@link BodyStore}, written while the body is sent. */
export interface BodyCopy {
  id: string;
  /** Settles once the copy was written completely, or was cancelled. */
  done: Promise<void>;
  /** Stops copying a body that is not sent anymore, e.g. because the request failed early. */
  cancel(): void;
}

/**
 * Copies a request body into the {@link BodyStore} while it is sent, so it is never held in
 * memory.
 * @param body the body that is about to be sent
 * @param headers the headers sent with the body
 * @returns the body to send instead of the given one, and its copy
 */
export function copyRequestBody(
  body: RequestBody,
  headers: HttpHeaders
): [RequestBody, BodyCopy | undefined] {
  if (body == null) return [body, undefined];

  if (body instanceof Readable) {
    const copy = bodyStore.create(headers);
    const recorder = new BodyRecorder(copy.stream);
    // undici destroys the body it sends with the error if the request fails, e.g. because the
    // connection was refused. The pipeline handles that error, as undici reports it already, and
    // destroys the original body along with the recorder.
    pipeline(body, recorder, () => {});
    return [
      recorder,
      toBodyCopy(copy, () => {
        if (!recorder.writableFinished) recorder.destroy();
      }),
    ];
  }

  // undici serializes form data internally, which cannot be observed from the outside. Serialize a
  // copy the same way; it only differs from the sent bytes in the random multipart boundary. This
  // serializes the form a second time, but HttpService already holds file fields in memory, so it
  // costs no additional disk reads.
  const multipart = new Response(body);
  const contentType = multipart.headers.get('content-type') ?? 'multipart/form-data';
  const copy = bodyStore.create({ ...headers, 'content-type': contentType });
  const source = multipart.body != null ? Readable.fromWeb(multipart.body) : Readable.from([]);
  pipeline(source, copy.stream, (error) => {
    if (error != null) logger.warn('Could not record the form data body', error);
  });
  return [body, toBodyCopy(copy, () => {})];
}

function toBodyCopy(copy: ReturnType<BodyStore['create']>, cancel: () => void): BodyCopy {
  return { id: copy.id, done: finished(copy.stream).catch(() => {}), cancel };
}
