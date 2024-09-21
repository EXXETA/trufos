import * as React from 'react';
import {Button} from '@/components/ui/button';
import {BookmarkIcon} from '@radix-ui/react-icons';

interface SaveButtonProps {
  change: boolean;
}

export const SaveButton: React.FC<SaveButtonProps> = ({change}) => {
  const [isActive, setIsActive] = React.useState(false);

  React.useEffect(() => {
    setIsActive(change);
  }, [change]);

  return (
    <Button className="gap-3 px-3 ml-2" variant="outline" disabled={!isActive}>
      <div><BookmarkIcon/></div>
      <span className="leading-4">Save</span>
    </Button>
  );
};