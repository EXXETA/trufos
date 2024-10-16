import { useEffect, useState } from 'react';
import { Divider } from '@/components/shared/Divider';
import { SettingsModal } from '@/components/shared/settings/SettingsModal';
import { FaGithub } from 'react-icons/fa';
import { RendererEventService } from '@/services/event/renderer-event-service';

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
        <div className="flex items-center space-x-4">
          {/* GitHub Icon */}
          <a href="https://github.com/yourusername" target="_blank" rel="noopener noreferrer">
            <FaGithub className="text-xl" /> {/* Adjust the size as needed */}
          </a>
          {/* Settings Icon */}
          <SettingsModal />
        </div>
      </div>
    </div>
  );
}
