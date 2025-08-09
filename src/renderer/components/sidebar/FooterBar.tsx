import { useEffect, useState } from 'react';

import { RendererEventService } from '@/services/event/renderer-event-service';
import { GithubIcon } from '@/components/icons';
import { SettingsModal } from '@/components/shared/settings/SettingsModal';
import { Divider } from '@/components/shared/Divider';
import { SidebarFooter } from '@/components/ui/sidebar';
import { ThemeToggle } from '@/components/shared/ThemeToggle';

export function FooterBar() {
  const [appVersion, setAppVersion] = useState<string>(undefined);

  useEffect(() => {
    RendererEventService.instance.getAppVersion().then(setAppVersion);
  }, []);

  return (
    <SidebarFooter className="mt-auto">
      <Divider />
      <div className="flex items-center justify-between">
        {/* Settings and theme toggle on the left */}
        <div className="flex items-center gap-2">
          <SettingsModal />
          <span className="shrink-0 text-[12px] leading-[1.2] font-medium tracking-[0px] whitespace-pre text-(--text-secondary) normal-case no-underline">
            Settings
          </span>
          <div className="ml-2">
            <ThemeToggle />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Icons and version on the right */}
          <span className="flex h-[15px] w-[26px] shrink-0 items-center self-center text-[12px] leading-[1.2] font-medium whitespace-pre text-(--text-secondary) normal-case no-underline">
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
