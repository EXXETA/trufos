import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { AppSettings } from 'shim/app-settings';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { useActions } from '@/state/helper/util';
import { showError } from '@/error/errorHandler';

const eventService = RendererEventService.instance;

const DEFAULT_APP_SETTINGS: AppSettings = { theme: 'system' };

interface AppSettingsActions {
  initialize(settings: AppSettings | undefined): void;
  updateSettings(partial: Partial<AppSettings>): void;
}

export const useAppSettingsStore = create<AppSettings & AppSettingsActions>()(
  immer((set, get) => ({
    ...DEFAULT_APP_SETTINGS,

    initialize(settings?: AppSettings) {
      set(() => settings ?? DEFAULT_APP_SETTINGS);
    },

    updateSettings(partial: Partial<AppSettings>) {
      set((state) => {
        Object.assign(state, partial);
      });
      void eventService
        .saveAppSettings(AppSettings.parse(get()))
        .catch((err) => showError('Failed to save app settings', err));
    },
  }))
);

export const selectThemePreference = (state: AppSettings & AppSettingsActions) => state.theme;
export const useAppSettingsActions = () => useAppSettingsStore(useActions());
