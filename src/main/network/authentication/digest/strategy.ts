import crypto from 'node:crypto';
import { DigestAuthorizationInformation } from 'shim/objects';
import { DisplayableError } from 'shim/error/DisplayableError';
import { RequestMethod } from 'shim/objects/request-method';
import AuthStrategy, { AuthRequestContext } from '../auth-strategy';
import { AuthChallenge, parseChallenges } from './challenge';

/**
 * The supported algorithms (RFC 7616 §6.1) and the Node.js names of their hash functions, from
 * weakest to strongest. The index is the strength of an algorithm.
 */
const ALGORITHMS = [
  ['md5', 'md5'],
  ['sha-256', 'sha256'],
  ['sha-512-256', 'sha512-256'],
] as const;

/** A supported Digest algorithm. */
export interface DigestAlgorithm {
  /** The algorithm as the server spelled it, if it named one. MD5 otherwise. */
  name?: string;
  /** The Node.js name of the hash function. */
  hash: string;
  /** Whether it is a session variant (`-sess`). */
  session: boolean;
  /** Higher is stronger. */
  strength: number;
}

/** A Digest challenge that can be answered. */
export interface DigestChallenge {
  realm: string;
  nonce: string;
  opaque?: string;
  algorithm: DigestAlgorithm;
  /** Whether the server offered `qop=auth`. Without qop, the legacy RFC 2069 digest is used. */
  hasQop: boolean;
}

/** Parses the algorithm of a challenge, or returns undefined if it is not supported. */
function parseAlgorithm(name?: string): DigestAlgorithm | undefined {
  const lowerCaseName = (name ?? 'MD5').toLowerCase();
  const session = lowerCaseName.endsWith('-sess');
  const baseName = session ? lowerCaseName.slice(0, -'-sess'.length) : lowerCaseName;
  const strength = ALGORITHMS.findIndex(([algorithm]) => algorithm === baseName);
  if (strength === -1) return undefined;
  return { name, hash: ALGORITHMS[strength][1], session, strength };
}

/** Returns the challenge as a {@link DigestChallenge}, or undefined if it cannot be answered. */
function toDigestChallenge({ scheme, params }: AuthChallenge): DigestChallenge | undefined {
  if (scheme !== 'digest' || params.realm == null || params.nonce == null) return undefined;
  const algorithm = parseAlgorithm(params.algorithm);
  if (algorithm == null) return undefined;
  // auth-int would hash the body, which is streamed and cannot be read twice
  const qops = params.qop?.split(',').map((qop) => qop.trim().toLowerCase());
  if (qops != null && !qops.includes('auth')) return undefined;
  return {
    realm: params.realm,
    nonce: params.nonce,
    opaque: params.opaque,
    algorithm,
    hasQop: qops != null,
  };
}

/**
 * Selects the Digest challenge to answer: the one with the strongest supported algorithm.
 * @param headers the values of the `WWW-Authenticate` headers
 * @returns the challenge, or undefined if there is no Digest challenge that can be answered
 */
export function selectDigestChallenge(headers: string[]): DigestChallenge | undefined {
  return parseChallenges(headers)
    .map(toDigestChallenge)
    .filter((challenge) => challenge != null)
    .sort((a, b) => b.algorithm.strength - a.algorithm.strength)[0];
}

/** Quotes a value for a header parameter. */
function quote(value: string): string {
  return `"${value.replace(/["\\]/g, '\\$&')}"`;
}

/**
 * Computes the `Authorization` header that answers a Digest challenge (RFC 7616, RFC 2069).
 * @param challenge the challenge of the server
 * @param credentials the username and password
 * @param request the method and the request target, i.e. the path and the query
 * @param cnonce the client nonce
 */
export function createDigestHeader(
  challenge: DigestChallenge,
  { username, password }: Pick<DigestAuthorizationInformation, 'username' | 'password'>,
  request: { method: RequestMethod; uri: string },
  cnonce: string
): string {
  const {
    algorithm: { hash, session, name: algorithm },
    realm,
    nonce,
  } = challenge;
  const h = (...parts: string[]) => crypto.createHash(hash).update(parts.join(':')).digest('hex');
  // every challenge is answered once, so the nonce count is always 1
  const nc = '00000001';

  let ha1 = h(username, realm, password);
  if (session) ha1 = h(ha1, nonce, cnonce);
  const ha2 = h(request.method, request.uri);
  const response = challenge.hasQop ? h(ha1, nonce, nc, cnonce, 'auth', ha2) : h(ha1, nonce, ha2);

  const params = [
    `username=${quote(username)}`,
    `realm=${quote(realm)}`,
    `nonce=${quote(nonce)}`,
    `uri=${quote(request.uri)}`,
  ];
  if (algorithm != null) params.push(`algorithm=${algorithm}`);
  params.push(`response=${quote(response)}`);
  if (challenge.opaque != null) params.push(`opaque=${quote(challenge.opaque)}`);
  if (challenge.hasQop) params.push('qop=auth', `nc=${nc}`, `cnonce=${quote(cnonce)}`);
  return `Digest ${params.join(', ')}`;
}

/**
 * HTTP Digest authentication. The server's challenge is fetched by sending the request without
 * its body first, the same way `curl --digest` does, as the body is streamed and cannot be sent
 * twice.
 */
export default class DigestAuthStrategy extends AuthStrategy<DigestAuthorizationInformation> {
  async getAuthHeader(context: AuthRequestContext): Promise<string> {
    const headers = await context.getChallenges();
    if (headers.length === 0) {
      throw new DisplayableError(
        'The server did not ask for authentication when the request was sent without its body.',
        'No Digest Challenge'
      );
    }
    const challenge = selectDigestChallenge(headers);
    if (challenge == null) {
      throw new DisplayableError(
        `The server asked for an authentication that is not supported: ${headers.join(', ')}`,
        'Unsupported Digest Challenge'
      );
    }

    const { pathname, search } = new URL(context.url);
    return createDigestHeader(
      challenge,
      this.authInfo,
      { method: context.method, uri: pathname + search },
      crypto.randomBytes(16).toString('hex')
    );
  }
}
