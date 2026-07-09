import z from 'zod';

export enum AssertionType {
  STATUS_CODE = 'status-code',
  RESPONSE_TIME = 'response-time',
  HEADER = 'header',
  JSON_PATH = 'json-path',
}

export enum AssertionOperator {
  EQUALS = 'equals',
  IN_RANGE = 'in-range',
  BELOW = 'below',
  PRESENT = 'present',
  CONTAINS = 'contains',
  EXISTS = 'exists',
}

export const Assertion = z.object({
  id: z.string(),
  isActive: z.boolean(),
  type: z.enum(AssertionType),
  operator: z.enum(AssertionOperator),
  target: z.string().optional(),
  expected: z.string().optional(),
});
export type Assertion = z.infer<typeof Assertion>;

export const AssertionResult = z.object({
  assertionId: z.string(),
  name: z.string(),
  passed: z.boolean(),
  message: z.string(),
});
export type AssertionResult = z.infer<typeof AssertionResult>;
