import { useEffect, useState } from 'react';

import { RendererEventService } from '@/services/event/renderer-event-service';
import { GithubIcon } from '@/components/icons';
import { SettingsModal } from '@/components/shared/settings/SettingsModal';

export function FooterBar() {
  const [appVersion, setAppVersion] = useState<string>(undefined);

  useEffect(() => {
    RendererEventService.instance.getAppVersion().then(setAppVersion);
  }, []);

  return (
    <div className="flex justify-between items-center">
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
      <SettingsModal className="flex items-center space-x-4" />
    </div>
  );
}
