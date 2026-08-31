import { useEffect, useState } from 'react';

import { RendererEventService } from '@/services/event/renderer-event-service';
import { GithubIcon } from '@/components/icons';
import { Divider } from '@/components/shared/Divider';
import { SidebarFooter } from '@/components/ui/sidebar';
import { useViewActions } from '@/state/viewStore';
import { FiSettings } from 'react-icons/fi';

export function FooterBar() {
  const [appVersion, setAppVersion] = useState<string | undefined>(undefined);
  const { openAppSettings } = useViewActions();

  useEffect(() => {
    RendererEventService.instance.getAppVersion().then(setAppVersion);
  }, []);

  return (
    <SidebarFooter className="mt-auto">
      <Divider />
      <div className="flex items-center justify-between">
        {/* Settings and theme toggle on the left */}
        <button
          type="button"
          onClick={openAppSettings}
          className="hover:text-foreground flex cursor-pointer items-center gap-2 text-(--text-secondary) transition-colors duration-300"
        >
          <div className="flex h-6 w-6 items-center justify-center">
            <FiSettings className="text-lg" />
          </div>
          <span className="shrink-0 text-[12px] leading-[1.2] font-medium tracking-normal whitespace-pre normal-case no-underline">
            Settings
          </span>
        </button>

        {/* Icons and version on the right */}
        <a
          href="https://github.com/EXXETA/trufos"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Visit Trufos GitHub repository"
          className="hover:text-foreground flex items-center gap-2 text-(--text-secondary) transition-colors duration-300"
        >
          <span className="flex h-3.75 w-6.5 shrink-0 items-center self-center text-[12px] leading-[1.2] font-medium whitespace-pre normal-case no-underline">
            {appVersion ?? null}
          </span>
          <GithubIcon />
        </a>
      </div>
    </SidebarFooter>
  );
}
