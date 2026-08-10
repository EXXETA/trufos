import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppSettingsModal } from './AppSettingsModal';
import { type AppSettings, TrufosLocale } from 'shim/app-settings';
import { i18n } from '@/i18n';

const updateSettingsMock = vi.fn();
let currentSettings: AppSettings = { theme: 'system', language: 'system' };

vi.mock('@/state/appSettingsStore', () => ({
  useAppSettingsStore: <T,>(selector: (state: AppSettings) => T) => selector(currentSettings),
  selectThemePreference: (state: AppSettings) => state.theme,
  selectLocalePreference: (state: AppSettings) => state.language,
  useAppSettingsActions: () => ({ updateSettings: updateSettingsMock }),
}));

describe('AppSettingsModal', () => {
  beforeEach(() => {
    currentSettings = { theme: 'system', language: 'system' };
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage(TrufosLocale.English);
  });

  it('offers System plus every supported locale', () => {
    render(<AppSettingsModal isOpen onClose={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'English' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Deutsch' })).toBeDefined();
  });

  it('persists the chosen locale', async () => {
    render(<AppSettingsModal isOpen onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Deutsch' }));

    expect(updateSettingsMock).toHaveBeenCalledWith({ language: TrufosLocale.German });
  });

  it('persists the chosen theme without touching the locale', async () => {
    render(<AppSettingsModal isOpen onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Dark' }));

    expect(updateSettingsMock).toHaveBeenCalledWith({ theme: 'dark' });
  });

  it('renders its own labels in the active locale', async () => {
    await i18n.changeLanguage(TrufosLocale.German);

    render(<AppSettingsModal isOpen onClose={vi.fn()} />);

    expect(screen.getByText('Einstellungen')).toBeDefined();
    expect(screen.getByText('Sprache')).toBeDefined();
    expect(screen.getByText('Erscheinungsbild')).toBeDefined();
  });

  // Guards the reason there is no I18nextProvider: `@/i18n` registers the instance as
  // react-i18next's default, so useTranslation() re-renders mounted components on a locale change.
  // If that ever stops holding, the app silently needs a restart to switch language.
  it('relabels already-mounted components when the locale changes', async () => {
    render(<AppSettingsModal isOpen onClose={vi.fn()} />);
    expect(screen.getByText('Settings')).toBeDefined();

    await act(async () => {
      await i18n.changeLanguage(TrufosLocale.German);
    });

    expect(screen.getByText('Einstellungen')).toBeDefined();
    expect(screen.queryByText('Settings')).toBeNull();
  });

  it('keeps language names untranslated so users can find their own', async () => {
    await i18n.changeLanguage(TrufosLocale.German);

    render(<AppSettingsModal isOpen onClose={vi.fn()} />);

    // "German" must never appear — a German speaker looks for "Deutsch".
    expect(screen.getByRole('button', { name: 'Deutsch' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'English' })).toBeDefined();
  });
});
