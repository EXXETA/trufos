import {
  VARIABLE_NAME_REGEX,
  VariableMap,
  VariableObject,
  VariableObjectWithKey,
} from 'shim/objects/variables';

export function variableMapToArray(map: VariableMap) {
  return Object.entries(map).map<VariableObjectWithKey>(([key, variable]) => ({
    key,
    ...variable,
  }));
}

export function variableArrayToMap(array: VariableObjectWithKey[]) {
  return Object.fromEntries<VariableObject>(array.map(({ key, ...variable }) => [key, variable]));
}

export function getInvalidVariableKeys(variables: VariableObjectWithKey[]) {
  const allKeys = new Set<string>();
  const invalidKeys = new Set<string>();
  for (const { key } of variables) {
    if (key === '' || key.length > 255 || allKeys.has(key) || !VARIABLE_NAME_REGEX.test(key)) {
      invalidKeys.add(key);
    }
    allKeys.add(key);
  }

  return invalidKeys;
}
