import { TabbedDialog } from '@/components/shared/TabbedDialog';
import { AppGeneralTab } from '@/components/shared/settings/AppGeneralTab/AppGeneralTab';
import { AppPluginsTab } from '@/components/shared/settings/AppPluginsTab/AppPluginsTab';

export interface AppSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AppSettingsModal = ({ isOpen, onClose }: AppSettingsModalProps) => (
  <TabbedDialog
    title="Settings"
    isOpen={isOpen}
    onClose={onClose}
    tabs={[
      { value: 'general', label: 'General', content: <AppGeneralTab /> },
      { value: 'plugins', label: 'Plugins', content: <AppPluginsTab /> },
    ]}
  />
);
