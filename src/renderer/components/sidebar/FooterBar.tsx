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
    <div className="fixed bottom-0 p-2 w-80">
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
