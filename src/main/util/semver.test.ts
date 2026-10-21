import { SemVer } from './semver';
import { describe, it, expect } from 'vitest';

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

  it.each<[string, string, boolean]>([
    ['1.2.3', '1.2.3', true],
    ['1.2.4', '1.2.3', false],
    ['1.2.3', '^1.2.3', true],
    ['1.9.0', '^1.2.3', true],
    ['1.2.2', '^1.2.3', false],
    ['2.0.0', '^1.2.3', false],
    ['0.2.9', '^0.2.3', true],
    ['0.3.0', '^0.2.3', false],
    ['0.0.3', '^0.0.3', true],
    ['0.0.4', '^0.0.3', false],
  ])('should check whether %s satisfies %s', (version, range, expected) => {
    expect(SemVer.parse(version).satisfies(range)).toBe(expected);
  });

  it.each(['>=1.0.0', '~1.0.0', '1.x', '^1'])('should reject the unsupported range %s', (range) => {
    expect(() => new SemVer(1, 0, 0).satisfies(range)).toThrow();
  });
});
