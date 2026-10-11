import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AppSettingsModal } from './AppSettingsModal';

const { openLogDirectoryMock, showErrorMock } = vi.hoisted(() => ({
  openLogDirectoryMock: vi.fn<() => Promise<void>>(),
  showErrorMock: vi.fn(),
}));

vi.mock('@/services/event/renderer-event-service', () => ({
  RendererEventService: { instance: { openLogDirectory: () => openLogDirectoryMock() } },
}));

vi.mock('@/error/errorHandler', () => ({
  showError: (message: string, error: unknown) => showErrorMock(message, error),
}));

vi.mock('@/state/appSettingsStore', () => ({
  selectThemePreference: (s: { theme: string }) => s.theme,
  useAppSettingsActions: () => ({ updateSettings: vi.fn() }),
  useAppSettingsStore: (selector: (s: { theme: string }) => unknown) =>
    selector({ theme: 'system' }),
}));

describe('AppSettingsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
