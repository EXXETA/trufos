import { VariableMap, VariableObject, VariableObjectWithKey } from 'shim/objects/variables';

export function variableMapToArray(map: VariableMap) {
  return Object.entries(map).map<VariableObjectWithKey>(([key, variable]) => ({
    key,
    ...variable,
  }));
}

export function variableArrayToMap(array: VariableObjectWithKey[]) {
  return Object.fromEntries<VariableObject>(array.map(({ key, ...variable }) => [key, variable]));
}
