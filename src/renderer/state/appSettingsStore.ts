import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { AppSettings, DEFAULT_APP_SETTINGS } from 'shim/app-settings';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { useActions } from '@/state/helper/util';
import { showError } from '@/error/errorHandler';
import { applyLocale, t } from '@/i18n';

const eventService = RendererEventService.instance;

interface AppSettingsActions {
  /** @param settings The persisted settings, which may predate any of the current fields */
  initialize(settings: unknown): void;
  updateSettings(partial: Partial<AppSettings>): void;
}

export const useAppSettingsStore = create<AppSettings & AppSettingsActions>()(
  immer((set, get) => ({
    ...DEFAULT_APP_SETTINGS,

    initialize(settings: unknown) {
      // Parsed rather than assigned, so a settings file written before a field existed picks up
      // that field's default instead of leaving the store with a hole in it.
      set(() => AppSettings.parse(settings ?? {}));
    },

    updateSettings(partial: Partial<AppSettings>) {
      set((state) => {
        Object.assign(state, partial);
      });
      void eventService
        .saveAppSettings(AppSettings.parse(get()))
        .catch((err) => showError(t('errors.saveAppSettings'), err));
    },
  }))
);

// One place applies the locale, so every way of changing the preference is covered without wiring:
// loading the stored settings, the settings modal, or whatever comes next.
useAppSettingsStore.subscribe((state, previous) => {
  if (state.language !== previous.language) void applyLocale(state.language);
});

export const selectThemePreference = (state: AppSettings & AppSettingsActions) => state.theme;
export const selectLocalePreference = (state: AppSettings & AppSettingsActions) => state.language;
export const useAppSettingsActions = () => useAppSettingsStore(useActions());
