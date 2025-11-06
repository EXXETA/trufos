import z from 'zod';

/** Regex for variable names, e.g. for collection variables */
export const VARIABLE_NAME_REGEX = /^[a-zA-Z_]+(-?[0-9a-zA-Z_]+)*$/;

/** A map of variable key => variables as `Record` */
export const VariableMap = z.record(z.string(), z.object());
export type VariableMap = Record<string, VariableObject>;

/** A variable object. Either a user defined variable or a system variable. */
export const VariableObject = z.object({
  /** The value of the variable. Might change on each call for dynamic variables */
  value: z.string(),
  /** A description of the variable. */
  description: z.string().optional(),
  /** If true, the variable is stored encrypted and hidden */
  secret: z.boolean().optional(),
});
export type VariableObject = z.infer<typeof VariableObject>;

export type VariableObjectWithKey = VariableObject & { key: string };
