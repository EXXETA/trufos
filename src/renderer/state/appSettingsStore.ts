import { AppSettings } from 'shim/app-settings';
import { useActions } from '@/state/helper/util';
import { useAppStore } from '@/state/collectionStore';

interface AppSettingsActions {
  initialize(settings: AppSettings | undefined): void;
  updateSettings(partial: Partial<AppSettings>): void;
}

type AppSettingsStoreState = AppSettings & AppSettingsActions;

export const useAppSettingsStore = <T>(selector: (state: AppSettingsStoreState) => T): T =>
  useAppStore((state) =>
    selector({
      theme: state.theme,
      initialize: state.initializeAppSettings,
      updateSettings: state.updateSettings,
    })
  );

export const selectThemePreference = (state: AppSettings & AppSettingsActions) => state.theme;
export const useAppSettingsActions = (): AppSettingsActions => useAppSettingsStore(useActions());
