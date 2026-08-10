import { app } from 'electron';
import { createI18n } from 'shim/i18n';

/**
 * The main process' localization, kept in sync with the renderer through the persisted app settings
 * rather than a dedicated IPC channel.
 *
 * Created at module load so the `uncaughtException` handler installed at startup can already
 * translate its error dialog. `app.getLocale()` is only reliable after `app.whenReady()`, so this may
 * start in the fallback locale until {@link applyLocale} runs with the stored preference.
 */
export const { t, applyLocale, onLocaleChange } = createI18n(() => app.getLocale());
