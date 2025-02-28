/** Regex for variable names, e.g. for collection variables */
export const VARIABLE_NAME_REGEX = /^[a-zA-Z_]+(-?[0-9a-zA-Z_]+)*$/;

/** A map of variable key => variables as `Record` */
export type VariableMap = Record<string, VariableObject>;

/** A variable object. Either a user defined variable or a system variable. */
export type VariableObject = {
  /** The value of the variable. Might change on each call for dynamic variables */
  value: string;

  /** A description of the variable. */
  description?: string;
};

export type VariableObjectWithKey = VariableObject & { key: string };
