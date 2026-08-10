import { initReactI18next } from 'react-i18next';
import { createI18n } from 'shim/i18n';

/**
 * The renderer's localization. It starts on the operating system locale because app settings arrive
 * asynchronously (see `App.tsx`), so guessing gets users who never changed the setting the right
 * language on the very first paint instead of a frame of English.
 *
 * Kept free of store imports so that non-React modules (stores, error handling) can translate without
 * an import cycle. `initReactI18next` registers the instance as react-i18next's default, so
 * `useTranslation()` resolves it without a surrounding provider — which also keeps components
 * renderable in isolation, as the component tests rely on.
 */
export const { i18n, t, applyLocale } = createI18n(() => navigator.language, initReactI18next);
