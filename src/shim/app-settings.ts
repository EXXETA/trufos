import { z } from 'zod';

export enum TrufosTheme {
  Light = 'light',
  Dark = 'dark',
}

export const ThemePreference = z.union([z.enum(TrufosTheme), z.literal('system')]);
export type ThemePreference = z.infer<typeof ThemePreference>;

export enum TrufosLocale {
  English = 'en',
  German = 'de',
}

/** The locale to render the app in, or `system` to follow the operating system. */
export const LocalePreference = z.union([z.enum(TrufosLocale), z.literal('system')]);
export type LocalePreference = z.infer<typeof LocalePreference>;

/**
 * Every field falls back to its default when missing or unreadable, which makes `AppSettings.parse()`
 * total and the single place that knows what "not set" means: a settings file written before a field
 * existed still parses, and adding a field later is a schema-only change.
 */
export const AppSettings = z.object({
  theme: ThemePreference.default('system').catch('system'),
  language: LocalePreference.default('system').catch('system'),
});
export type AppSettings = z.infer<typeof AppSettings>;

/** Shared by the main process settings file and the renderer store so the two cannot drift apart. */
export const DEFAULT_APP_SETTINGS = Object.freeze(AppSettings.parse({}));
