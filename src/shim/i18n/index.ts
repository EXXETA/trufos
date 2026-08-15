import { createInstance, type Module, type Resource } from 'i18next';
import { type LocalePreference, TrufosLocale } from '../app-settings';
import en from './locales/en.json';
import de from './locales/de.json';

/** Used whenever a requested locale has no catalog of its own. */
export const FALLBACK_LOCALE = TrufosLocale.English;

/**
 * The English catalog doubles as the key contract: {@link CatalogSchema} is derived from it, and the
 * parity test asserts every other catalog matches it exactly.
 */
export type CatalogSchema = typeof en;

// Makes `t()` keys checked against the English catalog in every project that imports this module, so
// a typo or a removed key is a `yarn typecheck` failure rather than a string rendered raw. Has to
// live in this runtime module: each process' tsconfig only includes its own folder, so a `.d.ts`
// next to this file would never be picked up.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: CatalogSchema };
    returnNull: false;
  }
}

/**
 * Everything a locale needs, in one table: adding a locale is a {@link TrufosLocale} member plus one
 * entry here. Labels are autonyms — a picker should name each language in that language — so they
 * live outside the catalogs and read the same whatever the active locale is.
 */
export const LOCALES: Record<TrufosLocale, { label: string; translation: CatalogSchema }> = {
  [TrufosLocale.English]: { label: 'English', translation: en },
  [TrufosLocale.German]: { label: 'Deutsch', translation: de },
};

const RESOURCES: Resource = Object.fromEntries(
  Object.entries(LOCALES).map(([locale, { translation }]) => [locale, { translation }])
);

/**
 * Turns a stored preference into a locale that actually has a catalog.
 *
 * @param preference The stored preference, or `system` to follow the operating system
 * @param systemLocale A BCP 47 tag such as `de-DE`; only the primary subtag is considered
 */
export function resolveLocale(preference: LocalePreference, systemLocale: string): TrufosLocale {
  const primarySubtag = (preference === 'system' ? systemLocale : preference)
    .split('-')[0]
    .toLowerCase();
  return primarySubtag in LOCALES ? (primarySubtag as TrufosLocale) : FALLBACK_LOCALE;
}

/**
 * Creates one process' localization. Both catalogs are bundled, so there is no asynchronous backend
 * and no loading state: `init()` completes before this returns, which is what lets `t()` work on the
 * very next line.
 *
 * Each process owns an instance; they are kept in sync through the persisted app settings.
 *
 * @param getSystemLocale Reads the operating system locale, which the two processes obtain from
 *   different places (`app.getLocale()` in main, `navigator.language` in the renderer)
 * @param modules Plugins to register before init, e.g. `initReactI18next` in the renderer
 */
export function createI18n(getSystemLocale: () => string, ...modules: Module[]) {
  const instance = createInstance();
  modules.forEach((module) => instance.use(module));
  void instance.init({
    lng: resolveLocale('system', getSystemLocale()),
    fallbackLng: FALLBACK_LOCALE,
    resources: RESOURCES,
    // Everything lives in one catalog per locale, so namespaces would only add ceremony.
    defaultNS: 'translation',
    interpolation: {
      // React escapes for us, and the main process only renders into native widgets.
      escapeValue: false,
    },
    // Nothing to load asynchronously, so init() can complete before it returns.
    initAsync: false,
  });

  return {
    /** The underlying i18next instance, for react-i18next and for tests. */
    i18n: instance,

    /** Translates a key in the active locale. Keeps following locale changes. */
    t: instance.t.bind(instance),

    /**
     * Switches to the given preference, resolving `system` against the current system locale.
     * Notifies {@link onLocaleChange} listeners only if that changes anything.
     *
     * @param preference The stored preference, or `system` to follow the operating system
     */
    async applyLocale(preference: LocalePreference = 'system') {
      const locale = resolveLocale(preference, getSystemLocale());
      if (locale !== instance.language) {
        await instance.changeLanguage(locale);
      }
    },

    /**
     * Subscribes to locale changes, so each surface can relabel itself instead of whatever triggered
     * the change having to know about all of them.
     *
     * @param listener Called after the active locale has changed
     * @returns A function that removes the listener again
     */
    onLocaleChange(listener: () => void) {
      instance.on('languageChanged', listener);
      return () => instance.off('languageChanged', listener);
    },
  };
}
