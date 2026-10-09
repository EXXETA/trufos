import { createServer, IncomingMessage, Server, ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';

/** The delay of the `/slow` route, long enough to observe the send button's in-flight state. */
const SLOW_RESPONSE_DELAY_MS = 2_000;

/** The body served by `/json`. Kept stable so it can back visual baselines later on. */
const JSON_BODY = {
  message: 'hello from the trufos e2e suite',
  id: 1,
  tags: ['e2e', 'smoke'],
};

export interface EchoServer {
  /** Origin of the running server, e.g. `http://127.0.0.1:53124`. */
  readonly baseUrl: string;

  /**
   * Origin of a port nothing listens on, for exercising the unreachable-server error path. The
   * port was bound and released during startup, so it is free rather than merely unlikely to be
   * taken.
   */
  readonly unreachableUrl: string;

  /** Builds an absolute URL for one of the served routes. */
  url(pathname: string): string;

  close(): Promise<void>;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const { pathname } = new URL(req.url ?? '/', 'http://127.0.0.1');

  if (pathname === '/json') {
    return sendJson(res, 200, JSON_BODY);
  }

  if (pathname === '/text') {
    const payload = 'plain text response';
    res.writeHead(200, {
      'content-type': 'text/plain',
      'content-length': Buffer.byteLength(payload),
    });
    return void res.end(payload);
  }

  if (pathname === '/echo') {
    return sendJson(res, 200, {
      method: req.method,
      headers: req.headers,
      body: await readBody(req),
    });
  }

  if (pathname === '/slow') {
    await new Promise((resolve) => setTimeout(resolve, SLOW_RESPONSE_DELAY_MS));
    return sendJson(res, 200, { ...JSON_BODY, slow: true });
  }

  const status = /^\/status\/(\d{3})$/.exec(pathname)?.[1];
  if (status != null) {
    return sendJson(res, Number(status), { status: Number(status) });
  }

  sendJson(res, 404, { error: 'not found' });
}

function listen(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port));
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

/**
 * Starts the local HTTP server the request-sending journeys send their requests to.
 *
 * Keeping the target in-process makes the suite hermetic: no external service can go down, no
 * request leaves the machine, and the response bodies stay byte-identical between runs.
 */
export async function startEchoServer(): Promise<EchoServer> {
  const server = createServer((req, res) => {
    handle(req, res).catch((error) => {
      console.error('echo server failed to handle a request:', error);
      if (!res.headersSent) sendJson(res, 500, { error: 'echo server failure' });
    });
  });

  // Keeping the process alive for the sake of the test server would hide a leaked fixture.
  server.unref();

  const port = await listen(server);

  const spare = createServer();
  const unreachablePort = await listen(spare);
  await close(spare);

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    unreachableUrl: `http://127.0.0.1:${unreachablePort}`,
    url: (pathname) => `http://127.0.0.1:${port}${pathname}`,
    close: () => close(server),
  };
}
