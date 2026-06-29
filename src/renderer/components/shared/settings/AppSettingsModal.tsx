import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { FiSettings } from 'react-icons/fi';
import { TrufosTheme, type ThemePreference } from 'shim/app-settings';
import { selectThemePreference, useAppSettingsActions, useAppSettingsStore } from '@/state/appSettingsStore';
import { cn } from '@/lib/utils';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: TrufosTheme.Light, label: 'Light' },
  { value: TrufosTheme.Dark, label: 'Dark' },
  { value: 'system', label: 'System' },
];

export const AppSettingsModal = () => {
  const theme = useAppSettingsStore(selectThemePreference);
  const { updateSettings } = useAppSettingsActions();

  return (
    <Dialog>
      <DialogTrigger>
        <FiSettings className="ml-2 text-xl" />
      </DialogTrigger>

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
        </div>
      </DialogContent>
    </Dialog>
  );
};
