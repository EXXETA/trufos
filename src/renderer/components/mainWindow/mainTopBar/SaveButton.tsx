import * as React from 'react';
import { Button } from '@/components/ui/button';
import { BookmarkIcon } from '@/components/icons';

interface SaveButtonProps {
  isDisabled: boolean;
  onClick?: () => void;
}

export const SaveButton: React.FC<SaveButtonProps> = ({ isDisabled = true, onClick }) => (
  <Button
    className={`absolute right-[16px] top-[8px] flex h-[24px] w-[24px] p-0 ${isDisabled ? 'border-0 bg-transparent text-(--disabled)' : ''}`}
    variant="secondary"
    disabled={isDisabled}
    onClick={onClick}
  >
    <BookmarkIcon />
  </Button>
);
