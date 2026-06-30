import { z } from 'zod';

export enum TrufosTheme {
  Light = 'light',
  Dark = 'dark',
}

export const ThemePreference = z.union([z.enum(TrufosTheme), z.literal('system')]);
export type ThemePreference = z.infer<typeof ThemePreference>;

export const AppSettings = z.object({
  theme: ThemePreference,
});
export type AppSettings = z.infer<typeof AppSettings>;
