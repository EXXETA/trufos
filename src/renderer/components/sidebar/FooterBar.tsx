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
          <span className="flex-shrink-0 whitespace-pre text-[12px] font-medium normal-case leading-[1.2] tracking-[0px] text-[#BBBBBB] no-underline">
            Settings
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Icons and version on the right */}
          <span className="flex h-[15px] w-[26px] flex-shrink-0 items-center self-center whitespace-pre text-[12px] font-medium normal-case leading-[1.2] text-[#BBBBBB] no-underline">
            {appVersion ?? null}
          </span>
          {/* GitHub Icon */}
          <a
            href="https://github.com/EXXETA/trufos"
            target="_blank"
            rel="noopener noreferrer"
            className="relative h-[24px] w-[24px] flex-shrink-0"
          >
            <GithubIcon className="absolute left-0 top-0 h-full w-full text-[#BBBBBB]" />
          </a>
        </div>
      </div>
    </SidebarFooter>
  );
}
