export type SemVerString<
  M extends number = number,
  S extends number = number,
  P extends number = number,
> = `${M}.${S}.${P}`;

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
  ): SemVer<M, S, P>;
  public static parse(version: string): SemVer;
  public static parse(version: string): SemVer {
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
    if (!match) throw new Error(`Invalid version: ${version}`);
    return new SemVer(parseInt(match[1]), parseInt(match[2]), parseInt(match[3]));
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

  /**
   * Checks whether this version is in the given range. A range is either an exact version
   * (`1.2.3`) or a caret range (`^1.2.3`), which allows changes that keep the left-most non-zero
   * part, like npm: `^1.2.3` is `>=1.2.3 <2.0.0`, `^0.2.3` is `>=0.2.3 <0.3.0` and `^0.0.3` is
   * only `0.0.3`.
   * @throws if the range is neither of the two
   */
  public satisfies(range: string): boolean {
    if (!range.startsWith('^')) return this.isEqualTo(SemVer.parse(range));
    const min = SemVer.parse(range.slice(1));
    if (this.isOlderThan(min)) return false;
    if (min.major !== 0) return this.major === min.major;
    if (min.minor !== 0) return this.major === 0 && this.minor === min.minor;
    return this.isEqualTo(min);
  }
}
