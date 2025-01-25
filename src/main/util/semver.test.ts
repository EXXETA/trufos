import { SemVer } from './semver';

describe('Semver', () => {
  it.each<[SemVer, SemVer, boolean]>([
    [new SemVer(1, 0, 0), new SemVer(1, 0, 1), true],
    [new SemVer(1, 2, 3), new SemVer(2, 0, 0), true],
    [new SemVer(1, 0, 1), new SemVer(1, 0, 0), false],
    [new SemVer(1, 0, 0), new SemVer(1, 0, 0), false],
  ])(`should implement ${SemVer.prototype.isOlderThan.name}() correctly`, (a, b, expected) => {
    expect(a.isOlderThan(b)).toBe(expected);
  });

  it.each<[SemVer, SemVer, boolean]>([
    [new SemVer(1, 0, 0), new SemVer(1, 0, 1), false],
    [new SemVer(1, 2, 3), new SemVer(2, 0, 0), false],
    [new SemVer(1, 0, 1), new SemVer(1, 0, 0), true],
    [new SemVer(1, 0, 0), new SemVer(1, 0, 0), false],
  ])(`should implement ${SemVer.prototype.isNewerThan.name}() correctly`, (a, b, expected) => {
    expect(a.isNewerThan(b)).toBe(expected);
  });

  it.each<[SemVer, SemVer, boolean]>([
    [new SemVer(1, 0, 0), new SemVer(1, 0, 1), false],
    [new SemVer(1, 0, 0), new SemVer(1, 0, 0), true],
  ])(`should implement ${SemVer.prototype.isEqualTo.name}() correctly`, (a, b, expected) => {
    expect(a.isEqualTo(b)).toBe(expected);
  });

  it('should parse versions correctly', () => {
    // Arrange
    const version = '1.2.3' as const;
    const expected = new SemVer(1, 2, 3);

    // Act
    const actual = SemVer.parse(version);

    // Assert
    expect(actual).toEqual(expected);
  });

  it('should throw an error when parsing an invalid version', () => {
    // Arrange
    const version = 'invalid' as `${number}.${number}.${number}`;

    // Act
    const action = () => SemVer.parse(version);

    // Assert
    expect(action).toThrow(`Invalid version: ${version}`);
  });

  it('should implement toString() correctly', () => {
    // Arrange
    const version = new SemVer(1, 2, 3);
    const expected = '1.2.3' as const;

    // Act
    const actual = version.toString();

    // Assert
    expect(actual).toBe(expected);
  });
});
