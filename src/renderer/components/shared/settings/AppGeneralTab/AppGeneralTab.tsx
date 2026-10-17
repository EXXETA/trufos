import {
  TrufosTheme,
  VERIFY_TLS_CERTIFICATES_LABEL,
  type ThemePreference,
} from 'shim/app-settings';
import {
  selectThemePreference,
  selectVerifyTlsCertificates,
  useAppSettingsActions,
  useAppSettingsStore,
} from '@/state/appSettingsStore';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { showError } from '@/error/errorHandler';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: TrufosTheme.Light, label: 'Light' },
  { value: TrufosTheme.Dark, label: 'Dark' },
  { value: 'system', label: 'System' },
];

/** The general app settings: appearance, network and access to the app log. */
export const AppGeneralTab = () => {
  const theme = useAppSettingsStore(selectThemePreference);
  const verifyTlsCertificates = useAppSettingsStore(selectVerifyTlsCertificates);
  const { updateSettings } = useAppSettingsActions();

  const openLogDirectory = () =>
    RendererEventService.instance
      .openLogDirectory()
      .catch((error) => showError('Could not open the logs folder', error));

  return (
    <div className="flex flex-col gap-6 p-4">
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
        <span className="text-sm font-medium text-(--text-primary)">Network</span>
        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-(--text-primary)">
          <Checkbox
            checked={verifyTlsCertificates}
            onCheckedChange={(checked) =>
              updateSettings({ verifyTlsCertificates: checked === true })
            }
          />
          {VERIFY_TLS_CERTIFICATES_LABEL}
        </label>
        <span className="text-sm text-(--text-secondary)">
          Requests to servers whose certificate cannot be verified, e.g. because it is self-signed,
          fail. Turn this off only for servers you trust.
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-(--text-primary)">Logs</span>
        <span className="text-sm text-(--text-secondary)">
          The app log helps with troubleshooting. It never contains requests, responses or script
          output – those are shown in the History tab.
        </span>
        <Button variant="secondary" size="sm" className="w-fit" onClick={openLogDirectory}>
          Open Logs Folder
        </Button>
      </div>
    </div>
  );
};
