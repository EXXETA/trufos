import { useEffect, useState } from 'react';
import { Divider } from '@/components/shared/Divider';

import { RendererEventService } from '@/services/event/renderer-event-service';
import { GithubIcon } from '@/components/icons';

export function FooterBar() {
  const [appVersion, setAppVersion] = useState<string>(undefined);

  useEffect(() => {
    RendererEventService.instance.getAppVersion().then(setAppVersion);
  }, []);

  return (
    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-sm p-2">
      <Divider />
      <div className="flex mt-2 justify-between items-center">
        {/* Version text on the left */}
        <span className="text-xs text-gray-500">{appVersion ?? null}</span>

        {/* Icons on the right */}
        {/* GitHub Icon */}
        <a
          className="flex items-center space-x-4"
          href="https://github.com/EXXETA/trufos"
          target="_blank"
          rel="noopener noreferrer"
        >
          <GithubIcon /> {/* Adjust the size as needed */}
        </a>
        {/*<SettingsModal />*/}
      </div>
    </div>
  );
}
