import * as React from 'react';
import { Button } from '@/components/ui/button';
import { BookmarkIcon } from '@radix-ui/react-icons';

interface SaveButtonProps {
  change: boolean;
  onClick?: () => void;
}

export const SaveButton: React.FC<SaveButtonProps> = ({ change, onClick }) => {
  const [isActive, setIsActive] = React.useState(false);

  React.useEffect(() => {
    setIsActive(change);
  }, [change]);

  return (
    <Button className="gap-3 px-3 ml-2" variant="outline" disabled={!isActive} onClick={onClick}>
      <div><BookmarkIcon /></div>
      <span className="leading-4">Save</span>
    </Button>
  );
};
