import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AppSettingsModal } from './AppSettingsModal';

const { openLogDirectoryMock, showErrorMock, updateSettingsMock, appSettings } = vi.hoisted(() => ({
  openLogDirectoryMock: vi.fn<() => Promise<void>>(),
  showErrorMock: vi.fn(),
  updateSettingsMock: vi.fn(),
  appSettings: { theme: 'system', verifyTlsCertificates: true },
}));

vi.mock('@/services/event/renderer-event-service', () => ({
  RendererEventService: { instance: { openLogDirectory: () => openLogDirectoryMock() } },
}));

vi.mock('@/error/errorHandler', () => ({
  showError: (message: string, error: unknown) => showErrorMock(message, error),
}));

vi.mock('@/state/appSettingsStore', () => ({
  selectThemePreference: (s: typeof appSettings) => s.theme,
  selectVerifyTlsCertificates: (s: typeof appSettings) => s.verifyTlsCertificates,
  useAppSettingsActions: () => ({ updateSettings: updateSettingsMock }),
  useAppSettingsStore: (selector: (s: typeof appSettings) => unknown) => selector(appSettings),
}));

describe('AppSettingsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appSettings.verifyTlsCertificates = true;
  });

  it('shows whether TLS certificates are verified', () => {
    appSettings.verifyTlsCertificates = false;
    render(<AppSettingsModal isOpen onClose={vi.fn()} />);

    const checkbox = screen.getByRole('checkbox', { name: 'Verify TLS certificates' });
    expect(checkbox.getAttribute('aria-checked')).toBe('false');
  });

  it('turns off verifying TLS certificates', async () => {
    render(<AppSettingsModal isOpen onClose={vi.fn()} />);
    const checkbox = screen.getByRole('checkbox', { name: 'Verify TLS certificates' });
    expect(checkbox.getAttribute('aria-checked')).toBe('true');

    await userEvent.click(checkbox);

    expect(updateSettingsMock).toHaveBeenCalledExactlyOnceWith({ verifyTlsCertificates: false });
  });

  it('shows the plugins on their own tab', async () => {
    render(<AppSettingsModal isOpen onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole('tab', { name: 'Plugins' }));

    expect(screen.getByText('No plugins are installed.')).toBeTruthy();
  });

  it('opens the logs folder via the event service', async () => {
    openLogDirectoryMock.mockResolvedValueOnce();
    render(<AppSettingsModal isOpen onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Open Logs Folder' }));

    expect(openLogDirectoryMock).toHaveBeenCalledOnce();
    expect(showErrorMock).not.toHaveBeenCalled();
  });

  it('shows an error when the logs folder cannot be opened', async () => {
    const error = new Error('nope');
    openLogDirectoryMock.mockRejectedValueOnce(error);
    render(<AppSettingsModal isOpen onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Open Logs Folder' }));

    await waitFor(() =>
      expect(showErrorMock).toHaveBeenCalledWith('Could not open the logs folder', error)
    );
  });
});
