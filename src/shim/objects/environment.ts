import z from 'zod';
import { VariableMap } from './variables';

/** An environment with variables. */
export const EnvironmentObject = z.object({
  /** Variables that exist in the environment */
  variables: VariableMap,
});
export type EnvironmentObject = z.infer<typeof EnvironmentObject>;

/** A map of environment key => environments as `Record` */
export const EnvironmentMap = z.record(z.string(), EnvironmentObject);
export type EnvironmentMap = z.infer<typeof EnvironmentMap>;

export const EnvironmentObjectWithKey = EnvironmentObject.extend({
  /** The unique key of the environment */
  key: z.string(),
});
export type EnvironmentObjectWithKey = z.infer<typeof EnvironmentObjectWithKey>;
