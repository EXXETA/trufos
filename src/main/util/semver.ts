type SemVerString<M extends number, S extends number, P extends number> = `${M}.${S}.${P}`;

/**
 * A semantic version implementation that is type-safe and immutable.
 */
export class SemVer<
  M extends number = number,
  S extends number = number,
  P extends number = number,
> {
  public readonly string: SemVerString<M, S, P>;

  constructor(
    public readonly major: M,
    public readonly minor: S,
    public readonly patch: P
  ) {
    this.string = `${major}.${minor}.${patch}`;
  }

  public static parse<M extends number, S extends number, P extends number>(
    version: SemVerString<M, S, P>
  ) {
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
    if (!match) throw new Error(`Invalid version: ${version}`);
    return new SemVer(parseInt(match[1]) as M, parseInt(match[2]) as S, parseInt(match[3]) as P);
  }

  public static compare(a: SemVer, b: SemVer) {
    return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
  }

  public toString() {
    return this.string;
  }

  public isOlderThan(version: SemVer) {
    return SemVer.compare(this, version) < 0;
  }

  public isNewerThan(version: SemVer) {
    return SemVer.compare(this, version) > 0;
  }

  public isEqualTo(version: SemVer) {
    return SemVer.compare(this, version) === 0;
  }
}
