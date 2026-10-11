import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TrufosTheme, type ThemePreference } from 'shim/app-settings';
import {
  selectThemePreference,
  useAppSettingsActions,
  useAppSettingsStore,
} from '@/state/appSettingsStore';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { showError } from '@/error/errorHandler';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: TrufosTheme.Light, label: 'Light' },
  { value: TrufosTheme.Dark, label: 'Dark' },
  { value: 'system', label: 'System' },
];

export interface AppSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AppSettingsModal = ({ isOpen, onClose }: AppSettingsModalProps) => {
  const theme = useAppSettingsStore(selectThemePreference);
  const { updateSettings } = useAppSettingsActions();

  const openLogDirectory = () =>
    RendererEventService.instance
      .openLogDirectory()
      .catch((error) => showError('Could not open the logs folder', error));

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-bold">Settings</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-6 py-2">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-(--text-primary)">Appearance</span>
            <div className="flex w-fit overflow-hidden rounded-md border border-(--border)">
              {THEME_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => updateSettings({ theme: value })}
                  className={cn(
                    'px-4 py-1.5 text-sm transition-colors',
                    theme === value
                      ? 'bg-(--accent-primary) text-white'
                      : 'text-(--text-secondary) hover:bg-(--border) hover:text-(--text-primary)'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-(--text-primary)">Logs</span>
            <span className="text-sm text-(--text-secondary)">
              The app log helps with troubleshooting. It never contains requests, responses or
              secrets.
            </span>
            <Button variant="secondary" size="sm" className="w-fit" onClick={openLogDirectory}>
              Open Logs Folder
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
