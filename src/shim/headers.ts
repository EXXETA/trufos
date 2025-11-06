import z from 'zod';

export const HttpHeaders = z.record(
  z.string(),
  z.union([z.string(), z.string().array(), z.undefined()])
);
export type HttpHeaders = z.infer<typeof HttpHeaders>;
