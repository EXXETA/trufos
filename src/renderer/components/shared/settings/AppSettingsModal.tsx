import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  type LocalePreference,
  type ThemePreference,
  TrufosLocale,
  TrufosTheme,
} from 'shim/app-settings';
import {
  selectLocalePreference,
  selectThemePreference,
  useAppSettingsActions,
  useAppSettingsStore,
} from '@/state/appSettingsStore';
import { LOCALES } from 'shim/i18n';
import { cn } from '@/lib/utils';

// Language names stay in their own language, so these are the same whatever the active locale is —
// only the "System" entry below is translated.
const LOCALE_OPTIONS = Object.entries(LOCALES).map(([locale, { label }]) => ({
  value: locale as TrufosLocale,
  label,
}));

export interface AppSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SegmentedControlProps<T extends string> {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

const SegmentedControl = <T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) => (
  <div className="flex flex-col gap-2">
    <span className="text-sm font-medium text-(--text-primary)">{label}</span>
    <div className="flex w-fit overflow-hidden rounded-md border border-(--border)">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'px-4 py-1.5 text-sm transition-colors',
            value === option.value
              ? 'bg-(--accent-primary) text-white'
              : 'text-(--text-secondary) hover:bg-(--border) hover:text-(--text-primary)'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  </div>
);

export const AppSettingsModal = ({ isOpen, onClose }: AppSettingsModalProps) => {
  const { t } = useTranslation();
  const theme = useAppSettingsStore(selectThemePreference);
  const language = useAppSettingsStore(selectLocalePreference);
  const { updateSettings } = useAppSettingsActions();

  const themeOptions: { value: ThemePreference; label: string }[] = [
    { value: TrufosTheme.Light, label: t('settings.theme.light') },
    { value: TrufosTheme.Dark, label: t('settings.theme.dark') },
    { value: 'system', label: t('settings.theme.system') },
  ];

  const languageOptions: { value: LocalePreference; label: string }[] = [
    { value: 'system', label: t('settings.language.system') },
    ...LOCALE_OPTIONS,
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-bold">{t('settings.title')}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-6 py-2">
          <SegmentedControl
            label={t('settings.appearance')}
            options={themeOptions}
            value={theme}
            onChange={(value) => updateSettings({ theme: value })}
          />

          <SegmentedControl
            label={t('settings.language.label')}
            options={languageOptions}
            value={language}
            onChange={(value) => updateSettings({ language: value })}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
