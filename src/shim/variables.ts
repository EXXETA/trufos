/** Regex for variable names, e.g. for collection variables */
export const VARIABLE_NAME_REGEX = /^[a-zA-Z_]+(-?[0-9a-zA-Z_]+)*$/;

export type VariableObject = {
  value: string;
  enabled: boolean;
};
