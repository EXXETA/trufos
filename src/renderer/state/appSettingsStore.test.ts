import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useAppSettingsStore } from './appSettingsStore';
import { i18n } from '@/i18n';
import { DEFAULT_APP_SETTINGS, TrufosLocale, TrufosTheme } from 'shim/app-settings';

const saveAppSettingsMock = vi.fn().mockResolvedValue(undefined);

vi.mock('@/services/event/renderer-event-service', () => ({
  RendererEventService: {
    instance: {
      saveAppSettings: (settings: unknown) => saveAppSettingsMock(settings),
    },
  },
}));

describe('appSettingsStore', () => {
  beforeEach(async () => {
    saveAppSettingsMock.mockClear();
    useAppSettingsStore.setState(DEFAULT_APP_SETTINGS);
    await i18n.changeLanguage(TrufosLocale.English);
  });

  it('fills in preferences the stored settings predate', () => {
    useAppSettingsStore.getState().initialize({ theme: 'dark' });

    expect(useAppSettingsStore.getState()).toMatchObject({ theme: 'dark', language: 'system' });
  });

  // The locale is applied by a single store subscription rather than per call site, so it has to hold
  // for every way of changing the preference — otherwise switching language needs a restart.
  it.each([
    [
      'loading the stored settings',
      () =>
        useAppSettingsStore
          .getState()
          .initialize({ theme: 'system', language: TrufosLocale.German }),
    ],
    [
      'changing the preference',
      () => useAppSettingsStore.getState().updateSettings({ language: TrufosLocale.German }),
    ],
  ])('applies the locale when %s', async (_name, act) => {
    act();

    await vi.waitFor(() => expect(i18n.language).toBe(TrufosLocale.German));
  });

  it('persists a changed preference without touching the others', () => {
    useAppSettingsStore.getState().updateSettings({ theme: TrufosTheme.Dark });

    expect(saveAppSettingsMock).toHaveBeenCalledWith({ theme: 'dark', language: 'system' });
  });
});
