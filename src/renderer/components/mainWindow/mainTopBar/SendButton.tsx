import * as React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRightIcon } from '@radix-ui/react-icons';

interface SendButtonProps {
  onClick: () => void;
}

export const SendButton: React.FC<SendButtonProps> = ({ onClick }) => (
  <Button className="gap-3 px-3 ml-2" onClick={onClick} variant="outline">
    <div><ArrowRightIcon /></div>
    <span className="leading-4">Send</span>
  </Button>
);
