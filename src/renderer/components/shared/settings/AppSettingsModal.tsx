import { TabbedDialog } from '@/components/shared/TabbedDialog';
import { AppGeneralTab } from '@/components/shared/settings/AppGeneralTab/AppGeneralTab';
import { HistoryTab } from '@/components/shared/settings/HistoryTab/HistoryTab';

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
      // the history scrolls its list and its details separately
      { value: 'history', label: 'History', content: <HistoryTab />, scroll: false },
    ]}
  />
);
