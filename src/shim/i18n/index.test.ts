import { describe, expect, it, vi } from 'vitest';
import { TrufosLocale } from '../app-settings';
import { createI18n, FALLBACK_LOCALE, LOCALES, resolveLocale } from './';

/** Flattens a nested catalog into the dotted key/value pairs i18next actually looks up. */
const entriesOf = (node: object, prefix = ''): [string, string][] =>
  Object.entries(node).flatMap(([key, value]): [string, string][] =>
    typeof value === 'string' ? [[`${prefix}${key}`, value]] : entriesOf(value, `${prefix}${key}.`)
  );

const keysOf = (locale: TrufosLocale) => entriesOf(LOCALES[locale].translation).map(([key]) => key);

// The whole point of this suite: it is the CI gate that replaces a build-time extraction step. A key
// left out of a catalog is already a typecheck error, but a stale one that no longer exists in
// en.json is only caught here.
describe('catalog parity', () => {
  const otherLocales = Object.values(TrufosLocale).filter((locale) => locale !== FALLBACK_LOCALE);

  it.each(otherLocales)('%s has exactly the same keys as the source catalog', (locale) => {
    expect(keysOf(locale).sort()).toEqual(keysOf(FALLBACK_LOCALE).sort());
  });

  it.each(Object.values(TrufosLocale))('%s has no blank translations', (locale) => {
    const blank = entriesOf(LOCALES[locale].translation)
      .filter(([, value]) => value.trim() === '')
      .map(([key]) => key);

    expect(blank).toEqual([]);
  });
});

describe('resolveLocale', () => {
  it.each([
    ['returns an explicitly chosen locale unchanged', TrufosLocale.German, 'en-US', 'de'],
    ['follows the system locale when the preference is "system"', 'system', 'de-DE', 'de'],
    ['ignores the region subtag', 'system', 'de-AT', 'de'],
    ['is case insensitive', 'system', 'DE', 'de'],
    ['falls back for unsupported system locales', 'system', 'fr-FR', FALLBACK_LOCALE],
    ['falls back for an empty system locale', 'system', '', FALLBACK_LOCALE],
  ] as const)('%s', (_name, preference, systemLocale, expected) => {
    expect(resolveLocale(preference, systemLocale)).toBe(expected);
  });
});

describe('createI18n', () => {
  it('is initialized on the system locale and translating synchronously', () => {
    const { i18n, t } = createI18n(() => 'de-DE');

    expect(i18n.isInitialized).toBe(true);
    expect(t('menu.documentation')).toBe('Dokumentation');
  });

  it('applies a locale preference and notifies listeners once', async () => {
    const { t, applyLocale, onLocaleChange } = createI18n(() => 'en');
    const listener = vi.fn();
    onLocaleChange(listener);

    await applyLocale(TrufosLocale.German);
    await applyLocale(TrufosLocale.German);

    expect(t('settings.title')).toBe('Einstellungen');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('stops notifying a listener that was removed', async () => {
    const { applyLocale, onLocaleChange } = createI18n(() => 'en');
    const listener = vi.fn();

    onLocaleChange(listener)();
    await applyLocale(TrufosLocale.German);

    expect(listener).not.toHaveBeenCalled();
  });

  it('keeps instances independent of each other', async () => {
    const first = createI18n(() => 'en');
    const second = createI18n(() => 'en');

    await second.applyLocale(TrufosLocale.German);

    expect(first.t('settings.title')).toBe('Settings');
    expect(second.t('settings.title')).toBe('Einstellungen');
  });
});
