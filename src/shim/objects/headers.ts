import z from 'zod';

export const TrufosHeader = z.object({
  key: z.string(),
  value: z.string(),
  isActive: z.boolean(),
});

export type TrufosHeader = z.infer<typeof TrufosHeader>;
