import { Agent, Dispatcher } from 'undici';
import fsp from 'node:fs/promises';
import tls from 'node:tls';
import type { ClientCertificate } from 'shim/objects/collection';
import { Cache, type CacheKey } from 'main/util/cache';
import { DisplayableError } from 'shim/error/DisplayableError';
import { isErrnoException } from 'shim/error/errno';

/** What the connections of a dispatcher depend on. */
export interface DispatcherOptions {
  /** Whether the TLS certificates of servers are verified, see the app settings. */
  verifyTlsCertificates: boolean;
  /** The client certificate of the collection, if any. */
  clientCertificate?: ClientCertificate;
}

export type AgentFactory = (options: Agent.Options) => Dispatcher;

/**
 * Keeps the dispatcher requests are sent with, so their connections are reused and the certificate
 * files are not read for every request. Only one collection is open at a time, so there is only one
 * dispatcher: it is replaced and closed once the options or the certificate files change.
 */
export class DispatcherCache {
  private readonly cache = new Cache<Dispatcher>({
    capacity: 1,
    // requests that are still sent with the replaced dispatcher finish before it closes
    dispose: (dispatcher) => dispatcher.close(),
  });

  constructor(private readonly createAgent: AgentFactory = (options) => new Agent(options)) {}

  /**
   * Returns the dispatcher for the given options.
   * @throws DisplayableError if a certificate file cannot be read
   */
  public async get(options: DispatcherOptions): Promise<Dispatcher> {
    try {
      return await this.cache.get(await getKey(options), () => this.build(options));
    } catch (error) {
      // the user configures these files and they can move or expire at any time
      if (!isErrnoException(error) || error.path == null) throw error;
      throw new DisplayableError(
        `Cannot read the file "${error.path}". Please check the client certificate in the settings of the collection.`,
        'Client Certificate Not Readable',
        error
      );
    }
  }

  private async build({
    verifyTlsCertificates,
    clientCertificate,
  }: DispatcherOptions): Promise<Dispatcher> {
    if (clientCertificate == null) {
      return this.createAgent({ connect: { rejectUnauthorized: verifyTlsCertificates } });
    }
    const { certPath, keyPath, caPath } = clientCertificate;
    const [cert, key, ca] = await Promise.all([
      fsp.readFile(certPath),
      keyPath != null ? fsp.readFile(keyPath) : undefined,
      caPath != null ? fsp.readFile(caPath) : undefined,
    ]);
    return this.createAgent({
      connect: {
        rejectUnauthorized: verifyTlsCertificates,
        cert,
        key,
        // a custom CA replaces the default ones, so they are passed as well
        ca: ca != null ? [...tls.getCACertificates(), ca] : undefined,
      },
    });
  }
}

/**
 * Identifies the dispatcher for the given options. It includes the modification times of the
 * certificate files, so a dispatcher is built again once they changed.
 */
async function getKey({
  verifyTlsCertificates,
  clientCertificate,
}: DispatcherOptions): Promise<CacheKey> {
  const paths = [
    clientCertificate?.certPath,
    clientCertificate?.keyPath,
    clientCertificate?.caPath,
  ];
  const modified = await Promise.all(
    paths.map(async (path) => (path == null ? undefined : (await fsp.stat(path)).mtimeMs))
  );
  return [verifyTlsCertificates, ...paths, ...modified];
}
