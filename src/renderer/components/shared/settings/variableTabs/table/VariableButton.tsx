import { Button } from '@/components/ui/button';
import { Divider } from '@/components/shared/Divider';
import { AddIcon } from '@/components/icons';

interface VariableButtonProps {
  add: () => void;
}

export const VariableButton = ({ add }: VariableButtonProps) => {
  return (
    <div className="top-4 right-4 left-4">
      <div className="flex">
        <Button
          className="hover:bg-transparent gap-1 h-fit"
          size="sm"
          variant="ghost"
          onClick={add}
        >
          <AddIcon /> Add Variable
        </Button>
      </div>
      <Divider className="mt-2 mb-4" />
    </div>
  );
};
