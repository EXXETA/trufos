import React from 'react';
import { Divider } from '@/components/shared/Divider';
import { SettingsModal } from '@/components/shared/settings/SettingsModal';
import { FaGithub } from 'react-icons/fa';
import { cn } from '@/lib/utils';

export interface FooterBarProps {
  className?: string;
}
export function FooterBar({ className }: FooterBarProps) {
  return (
      <div className={cn('p-2 w-full', className)}>
        <Divider className="w-full" />
        <div className="flex mt-2 justify-end">
          <a href="https://github.com/yourusername" target="_blank" rel="noopener noreferrer" className="ml-4">
            <FaGithub className="text-xl" />
          </a>
          <SettingsModal />
        </div>
      </div>
  );
}
