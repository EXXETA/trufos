import { describe, expect, it, vi } from 'vitest';
import { Readable } from 'node:stream';
import { buffer, text } from 'node:stream/consumers';
import { FormData } from 'undici';
import { BodyStore } from './body-store';
import { copyRequestBody } from './request-body-copy';

const bodyStore = BodyStore.instance;

function readBody(id: string) {
  return buffer(bodyStore.openBody(id)!);
}

describe('copyRequestBody', () => {
  it('should not copy a missing body', () => {
    expect(copyRequestBody(undefined, {})).toEqual([undefined, undefined]);
  });

  it('should pass a stream through unchanged and copy it', async () => {
    // Act
    const [sent, copy] = copyRequestBody(Readable.from(['{"name":', '"Ada"}']), {
      'content-type': 'application/json',
    });
    const passed = await text(sent as Readable);
    await copy!.done;

    // Assert
    expect(passed).toBe('{"name":"Ada"}');
    expect((await readBody(copy!.id)).toString()).toBe('{"name":"Ada"}');
    expect(bodyStore.getSize(copy!.id)).toBe(14);
    expect(bodyStore.getHeaders(copy!.id)).toEqual({ 'content-type': 'application/json' });
  });

  it('should copy binary bodies byte by byte', async () => {
    const bytes = Buffer.from([0, 255, 1, 254]);

    const [sent, copy] = copyRequestBody(Readable.from([bytes]), {});
    await buffer(sent as Readable);
    await copy!.done;

    expect(await readBody(copy!.id)).toEqual(bytes);
  });

  it('should copy form data as multipart body and send the form itself', async () => {
    const form = new FormData();
    form.append('name', 'Ada');
    form.append('avatar', new File(['abc'], 'ada.png'));

    const [sent, copy] = copyRequestBody(form, {});
    await copy!.done;

    expect(sent).toBe(form);
    const body = (await readBody(copy!.id)).toString();
    expect(body).toContain('name="name"\r\n\r\nAda');
    expect(body).toContain('filename="ada.png"');
    expect(bodyStore.getHeaders(copy!.id)?.['content-type']).toMatch(
      /^multipart\/form-data; boundary=/
    );
  });

  it('should stop copying a body that is never read once cancelled', async () => {
    const [, copy] = copyRequestBody(Readable.from(['never sent']), {});

    copy!.cancel();

    await copy!.done;
    expect(bodyStore.getSize(copy!.id)).toBe(0);
  });

  it('should not throw an uncaught error if undici destroys the body of a failed request', async () => {
    // Arrange
    const uncaught = vi.fn();
    process.on('uncaughtException', uncaught);
    const source = Readable.from(['partial body']);

    // Act: like undici on a refused connection, destroy the sent body with the error
    const [sent, copy] = copyRequestBody(source, {});
    (sent as Readable).destroy(new Error('connect ECONNREFUSED'));
    await copy!.done;
    await vi.waitFor(() => expect(source.destroyed).toBe(true));
    process.off('uncaughtException', uncaught);

    // Assert
    expect(uncaught).not.toHaveBeenCalled();
  });
});
