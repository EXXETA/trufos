/** An authentication challenge of a `WWW-Authenticate` header (RFC 9110 §11.6.1). */
export interface AuthChallenge {
  /** The authentication scheme in lower case, e.g. "digest". */
  scheme: string;
  /** The parameters of the challenge by their lower-case name. */
  params: Record<string, string>;
}

const TOKEN = /[!#$%&'*+\-.^_`|~0-9A-Za-z]+/y;
const TOKEN68 = /[A-Za-z0-9\-._~+/]+=*/y;
const WHITESPACE = /[ \t]*/y;

/** A minimal scanner over a header value. */
class Scanner {
  private position = 0;

  constructor(private readonly input: string) {}

  get done(): boolean {
    this.skipWhitespace();
    return this.position >= this.input.length;
  }

  peek(): string | undefined {
    this.skipWhitespace();
    return this.input[this.position];
  }

  skip(char: string): boolean {
    if (this.peek() !== char) return false;
    this.position++;
    return true;
  }

  match(pattern: RegExp): string | undefined {
    this.skipWhitespace();
    pattern.lastIndex = this.position;
    const match = pattern.exec(this.input);
    if (match == null || match[0] === '') return undefined;
    this.position = pattern.lastIndex;
    return match[0];
  }

  /** Reads a quoted string, starting at its opening quote, and returns it unescaped. */
  quotedString(): string | undefined {
    if (!this.skip('"')) return undefined;
    let value = '';
    while (this.position < this.input.length) {
      const char = this.input[this.position++];
      if (char === '"') return value;
      value += char === '\\' ? (this.input[this.position++] ?? '') : char;
    }
    return undefined;
  }

  /** Remembers the position to go back to it with {@link reset}. */
  mark(): number {
    return this.position;
  }

  reset(position: number): void {
    this.position = position;
  }

  private skipWhitespace(): void {
    WHITESPACE.lastIndex = this.position;
    WHITESPACE.exec(this.input);
    this.position = WHITESPACE.lastIndex;
  }
}

/**
 * Reads an auth-param (`name=value`), or returns undefined and leaves the position unchanged if
 * there is none, e.g. because the next challenge starts.
 */
function readParam(scanner: Scanner): [string, string] | undefined {
  const start = scanner.mark();
  const name = scanner.match(TOKEN);
  if (name != null && scanner.skip('=')) {
    const value = scanner.peek() === '"' ? scanner.quotedString() : scanner.match(TOKEN);
    if (value != null) return [name.toLowerCase(), value];
  }
  scanner.reset(start);
  return undefined;
}

/**
 * Parses the challenges of `WWW-Authenticate` header values. A value may hold several challenges,
 * e.g. `Digest realm="a", nonce="b", Basic realm="a"`. Malformed parts are skipped.
 * @param headers the values of the `WWW-Authenticate` headers
 */
export function parseChallenges(headers: string[]): AuthChallenge[] {
  const challenges: AuthChallenge[] = [];
  for (const header of headers) {
    const scanner = new Scanner(header);
    while (!scanner.done) {
      if (scanner.skip(',')) continue;
      const scheme = scanner.match(TOKEN);
      if (scheme == null) break;
      const challenge: AuthChallenge = { scheme: scheme.toLowerCase(), params: {} };
      challenges.push(challenge);

      let param = readParam(scanner);
      // a challenge without parameters may carry a token68 instead, e.g. "Negotiate abc=="
      if (param == null) scanner.match(TOKEN68);
      while (param != null) {
        challenge.params[param[0]] = param[1];
        param = scanner.skip(',') ? readParam(scanner) : undefined;
      }
    }
  }
  return challenges;
}
