import { getSystemVariable, getSystemVariableKeys, getSystemVariables } from './system-variable';

describe('getSystemVariable()', () => {
  it('should return the the system variable object', () => {
    // Arrange
    const key = '$randomUuid';

    // Act
    const result = getSystemVariable(key);

    // Assert
    expect(result.key).toBe(key);
    expect(result.value).toBeDefined();
    expect(result.description).toBeDefined();
  });

  it('should return a random UUID for $randomUuid', () => {
    // Arrange
    const key = '$randomUuid';

    // Act
    const firstValue = getSystemVariable(key).value;
    const secondValue = getSystemVariable(key).value;

    // Assert
    expect(firstValue).not.toBe(secondValue);
  });
});

describe('getSystemVariableKeys()', () => {
  it('should return all system variable keys', () => {
    // Act
    const result = getSystemVariableKeys();

    // Assert
    expect(result).toContain('$randomUuid');
    expect(result).toHaveLength(6);
  });
});

describe('getSystemVariables()', () => {
  it('should return all system variables', () => {
    // Act
    const result = getSystemVariables();

    // Assert
    expect(result).toContainEqual({
      key: '$randomUuid',
      isActive: true,
      value: expect.any(String),
      description: expect.any(String),
    });
    expect(result).toHaveLength(6);
  });
});
