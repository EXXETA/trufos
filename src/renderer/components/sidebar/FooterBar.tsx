import { useEffect, useState } from 'react';

import { RendererEventService } from '@/services/event/renderer-event-service';
import { GithubIcon } from '@/components/icons';
import { AppSettingsModal } from '@/components/shared/settings/AppSettingsModal';
import { Divider } from '@/components/shared/Divider';
import { SidebarFooter } from '@/components/ui/sidebar';

export function FooterBar() {
  const [appVersion, setAppVersion] = useState<string | undefined>(undefined);

  useEffect(() => {
    RendererEventService.instance.getAppVersion().then(setAppVersion);
  }, []);

  return (
    <SidebarFooter className="mt-auto">
      <Divider />
      <div className="flex items-center justify-between">
        {/* Settings and theme toggle on the left */}
        <div className="flex items-center gap-2">
          <AppSettingsModal />
          <span className="shrink-0 text-[12px] leading-[1.2] font-medium tracking-normal whitespace-pre text-(--text-secondary) normal-case no-underline">
            Settings
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Icons and version on the right */}
          <span className="flex h-3.75 w-6.5 shrink-0 items-center self-center text-[12px] leading-[1.2] font-medium whitespace-pre text-(--text-secondary) normal-case no-underline">
            {appVersion ?? null}
          </span>
          {/* GitHub Icon */}
          <a href="https://github.com/EXXETA/trufos" target="_blank" rel="noopener noreferrer">
            <GithubIcon />
          </a>
        </div>
      </div>
    </SidebarFooter>
  );
}
