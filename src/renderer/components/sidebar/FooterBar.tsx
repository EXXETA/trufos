import React, { useState } from 'react';
import { Divider } from '@/components/shared/Divider';
import { SettingsModal } from '@/components/shared/settings/SettingsModal';

import { FaGithub } from 'react-icons/fa';

export function FooterBar() {

  return (
    <div className="fixed bottom-0 p-2 w-80">
      <Divider />
      <div className="flex mt-2 justify-end">
        {/* GitHub Icon */}
        <a href="https://github.com/yourusername" target="_blank" rel="noopener noreferrer"
           className="ml-4">
          <FaGithub className="text-xl" /> {/* Adjust the size as needed */}
        </a>
        {/* Settings Icon */}
        <SettingsModal />
      </div>
    </div>
  );
}
