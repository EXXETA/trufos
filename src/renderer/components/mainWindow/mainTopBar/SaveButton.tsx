import * as React from 'react';
import { Button } from '@/components/ui/button';
import { BookmarkIcon } from '@radix-ui/react-icons';

interface SaveButtonProps {
  disabled: boolean;
  onClick?: () => void;
}

export const SaveButton: React.FC<SaveButtonProps> = ({ disabled, onClick }) => {
  const [isDisabled, setIsDisabled] = React.useState(false);

  React.useEffect(() => {
    setIsDisabled(disabled);
  }, [disabled]);

  return (
    <Button className="gap-3 px-3 ml-2" variant="outline" disabled={isDisabled} onClick={onClick}>
      <div>
        <BookmarkIcon />
      </div>
      <span className="leading-4">Save</span>
    </Button>
  );
};
