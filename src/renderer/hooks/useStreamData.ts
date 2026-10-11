import { useEffect, useMemo } from 'react';
import { getToastForError } from '@/components/ui/use-toast';
import { IpcPushStream } from '@/lib/ipc-stream';
import { StreamInput, StringBufferEncoding } from 'shim/ipc-stream';

/**
 * Streams data from the main process and passes it to `onChange` once it was read completely.
 * @param input what to stream, or `undefined` if there is nothing to stream, e.g. a response
 * without a body. Must be stable across renders, e.g. memoized.
 * @param encoding the encoding of the data passed to `onChange`
 * @param onChange receives the data, or an empty string if there is nothing to stream
 * @param maxBytes if set, only this many bytes are read
 */
export const useStreamData = (
  input: StreamInput | undefined,
  encoding: StringBufferEncoding,
  onChange: (data: string) => void,
  maxBytes?: number
): void => {
  useEffect(() => {
    if (input == null) {
      onChange('');
      return;
    }

    let canceled = false;
    let stream: IpcPushStream | undefined;
    IpcPushStream.open(input, encoding, maxBytes)
      .then((s) => {
        if (canceled) {
          s.close();
          return;
        }
        stream = s;
        return s.readAll();
      })
      .then((content) => {
        if (!canceled && content !== undefined) onChange(content);
      })
      .catch(getToastForError);

    return () => {
      canceled = true;
      stream?.close();
    };
  }, [input, encoding, onChange, maxBytes]);
};

/**
 * @param id the ID of a body stored in the main process, e.g. of a response
 * @returns the stream input of the body, stable across renders, or `undefined` if there is none
 */
export const useBodyInput = (id: string | undefined): StreamInput | undefined =>
  useMemo(() => (id != null ? { type: 'body', id } : undefined), [id]);
