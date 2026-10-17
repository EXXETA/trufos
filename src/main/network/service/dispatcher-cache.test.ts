import { beforeEach, describe, expect, it, vi } from 'vitest';
import fsp from 'node:fs/promises';
import tls from 'node:tls';
import { type Agent, type Dispatcher, MockAgent } from 'undici';
import { DispatcherCache } from './dispatcher-cache';

const CERT_PATH = '/certs/client.crt';
const KEY_PATH = '/certs/client.key';
const CA_PATH = '/certs/ca.crt';

function fakeDispatcher(): Dispatcher {
  const dispatcher = new MockAgent();
  vi.spyOn(dispatcher, 'close');
  return dispatcher;
}

describe('DispatcherCache', () => {
  let createAgent: ReturnType<typeof vi.fn<(options: Agent.Options) => Dispatcher>>;
  let cache: DispatcherCache;

  beforeEach(async () => {
    createAgent = vi.fn(() => fakeDispatcher());
    cache = new DispatcherCache(createAgent);
    await fsp.mkdir('/certs', { recursive: true });
    await fsp.writeFile(CERT_PATH, 'cert');
    await fsp.writeFile(KEY_PATH, 'key');
    await fsp.writeFile(CA_PATH, 'ca');
  });

  it.each([true, false])(
    'rejects unauthorized certificates if verifying them is %s',
    async (verifyTlsCertificates) => {
      await cache.get({ verifyTlsCertificates });

      expect(createAgent).toHaveBeenCalledExactlyOnceWith({
        connect: { rejectUnauthorized: verifyTlsCertificates },
      });
    }
  );

  it('reuses the dispatcher while the options stay the same', async () => {
    const options = {
      verifyTlsCertificates: true,
      clientCertificate: { certPath: CERT_PATH, keyPath: KEY_PATH },
    };
    const readFile = vi.spyOn(fsp, 'readFile');

    const first = await cache.get(options);
    const second = await cache.get({
      ...options,
      clientCertificate: { ...options.clientCertificate },
    });

    expect(second).toBe(first);
    expect(createAgent).toHaveBeenCalledOnce();
    expect(readFile).toHaveBeenCalledTimes(2);
  });

  it('tells apart the same file used as a different part of the client certificate', async () => {
    const first = await cache.get({
      verifyTlsCertificates: true,
      clientCertificate: { certPath: CERT_PATH, keyPath: CA_PATH },
    });

    const second = await cache.get({
      verifyTlsCertificates: true,
      clientCertificate: { certPath: CERT_PATH, caPath: CA_PATH },
    });

    expect(second).not.toBe(first);
  });

  it('creates a dispatcher once for concurrent requests', async () => {
    const [first, second] = await Promise.all([
      cache.get({ verifyTlsCertificates: true }),
      cache.get({ verifyTlsCertificates: true }),
    ]);

    expect(second).toBe(first);
    expect(createAgent).toHaveBeenCalledOnce();
  });

  it('closes the previous dispatcher when the options change', async () => {
    const first = await cache.get({ verifyTlsCertificates: true });

    const second = await cache.get({ verifyTlsCertificates: false });

    expect(second).not.toBe(first);
    expect(first.close).toHaveBeenCalledOnce();
    expect(second.close).not.toHaveBeenCalled();
  });

  it('reads the certificate files again once they changed', async () => {
    const options = { verifyTlsCertificates: true, clientCertificate: { certPath: CERT_PATH } };
    const first = await cache.get(options);

    await fsp.writeFile(CERT_PATH, 'renewed cert');
    await fsp.utimes(CERT_PATH, new Date(), new Date(Date.now() + 60_000));
    const second = await cache.get(options);

    expect(second).not.toBe(first);
    expect(createAgent).toHaveBeenLastCalledWith({
      connect: expect.objectContaining({ cert: Buffer.from('renewed cert') }),
    });
  });

  it('uses the client certificate and trusts its CA in addition to the default ones', async () => {
    await cache.get({
      verifyTlsCertificates: true,
      clientCertificate: { certPath: CERT_PATH, keyPath: KEY_PATH, caPath: CA_PATH },
    });

    expect(createAgent).toHaveBeenCalledExactlyOnceWith({
      connect: {
        rejectUnauthorized: true,
        cert: Buffer.from('cert'),
        key: Buffer.from('key'),
        ca: [...tls.getCACertificates(), Buffer.from('ca')],
      },
    });
  });

  it('does not keep a dispatcher whose certificate could not be read', async () => {
    const options = { verifyTlsCertificates: true, clientCertificate: { certPath: '/missing' } };

    await expect(cache.get(options)).rejects.toThrow();
    await fsp.writeFile('/missing', 'cert');

    await expect(cache.get(options)).resolves.toBeDefined();
  });
});
