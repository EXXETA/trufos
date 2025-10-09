import * as React from 'react';
import { Button } from '@/components/ui/button';
import { BookmarkIcon } from '@/components/icons';

interface SaveButtonProps {
  isDisabled: boolean;
  onClick?: () => void;
}

export const SaveButton: React.FC<SaveButtonProps> = ({ isDisabled = true, onClick }) => (
  <Button
    className={`absolute top-[8px] right-[16px] flex h-[24px] w-[24px] p-0 ${isDisabled ? 'border-0 bg-transparent text-(--disabled)' : ''}`}
    variant="secondary"
    disabled={isDisabled}
    onClick={onClick}
  >
    <BookmarkIcon />
  </Button>
);
