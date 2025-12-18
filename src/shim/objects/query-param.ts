import z from 'zod';

export const TrufosQueryParam = z.object({
  key: z.string(),
  value: z.string().optional(),
  isActive: z.boolean(),
});

export type TrufosQueryParam = z.infer<typeof TrufosQueryParam>;
