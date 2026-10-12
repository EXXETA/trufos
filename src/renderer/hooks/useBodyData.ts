import { useEffect } from 'react';
import { getToastForError } from '@/components/ui/use-toast';
import { IpcPushStream } from '@/lib/ipc-stream';
import type { StringBufferEncoding } from 'shim/ipc-stream';

/**
 * Streams a body stored in the main process, e.g. of a response, and passes it to `onChange` once
 * it was read completely.
 * @param bodyId the ID of the body, or `undefined` if there is none, e.g. for a response without
 * a body
 * @param encoding the encoding of the data passed to `onChange`
 * @param onChange receives the body, or an empty string if there is none
 * @param maxBytes if set, only this many bytes are read
 */
export const useBodyData = (
  bodyId: string | undefined,
  encoding: StringBufferEncoding,
  onChange: (data: string) => void,
  maxBytes?: number
): void => {
  useEffect(() => {
    if (bodyId == null) {
      onChange('');
      return;
    }

    let canceled = false;
    let stream: IpcPushStream | undefined;
    IpcPushStream.open({ type: 'body', id: bodyId }, encoding, maxBytes)
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
  }, [bodyId, encoding, onChange, maxBytes]);
};
