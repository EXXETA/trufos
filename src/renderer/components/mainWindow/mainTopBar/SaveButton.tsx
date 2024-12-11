import * as React from 'react';
import { Button } from '@/components/ui/button';
import { BookmarkIcon } from '@/components/icons';

interface SaveButtonProps {
  isDisabled: boolean;
  onClick?: () => void;
}

export const SaveButton: React.FC<SaveButtonProps> = ({ isDisabled = true, onClick }) => (
  <Button
    className={`flex p-0 w-[24px] h-[24px] absolute top-[8px] right-[16px] ${isDisabled ? 'bg-transparent border-0 text-[var(--disabled)]' : ''}`}
    variant="secondary"
    disabled={isDisabled}
    onClick={onClick}
  >
    <BookmarkIcon />
  </Button>
);
