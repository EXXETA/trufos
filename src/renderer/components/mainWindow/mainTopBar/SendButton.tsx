import * as React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowForwardIcon } from '@/components/icons';

interface SendButtonProps {
  onClick: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
}

export const SendButton: React.FC<SendButtonProps> = ({ onClick, disabled = false, children }) => (
  <Button className="gap-3 pl-[30px]" onClick={onClick} variant="secondary" disabled={disabled}>
    <span className="leading-4 font-bold">Send</span>

    {children ?? <ArrowForwardIcon />}
  </Button>
);
