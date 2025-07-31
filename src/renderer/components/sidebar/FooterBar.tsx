import { useEffect, useState } from 'react';

import { RendererEventService } from '@/services/event/renderer-event-service';
import { GithubIcon } from '@/components/icons';
import { SettingsModal } from '@/components/shared/settings/SettingsModal';
import { Divider } from '@/components/shared/Divider';
import { SidebarFooter } from '@/components/ui/sidebar';

export function FooterBar() {
  const [appVersion, setAppVersion] = useState<string>(undefined);

  useEffect(() => {
    RendererEventService.instance.getAppVersion().then(setAppVersion);
  }, []);

  return (
    <SidebarFooter className="mt-auto">
      <Divider />
      <div className="flex items-center justify-between">
        {/* Settings and icon on the left */}
        <div className="flex items-center gap-2">
          <SettingsModal />
          <span className="text-xs text-gray-500">Settings</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Icons and version on the right */}
          <span className="text-xs text-gray-500">{appVersion ?? null}</span>
          {/* GitHub Icon */}
          <a href="https://github.com/EXXETA/trufos" target="_blank" rel="noopener noreferrer">
            <GithubIcon /> {/* Adjust the size as needed */}
          </a>
        </div>
      </div>
    </SidebarFooter>
  );
}
