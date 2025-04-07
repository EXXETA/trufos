import { NamingModal } from '@/components/shared/modal/NamingModal';
import { useEffect, useState } from 'react';
import { EnvironmentMap } from '../../../../../../shim/objects/environment';

interface EnvironmentVariableEditorProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  environments: EnvironmentMap;
  onEnvironmentChange: (variables: EnvironmentMap) => void;
  setSelectedEnvironment: (environment: string) => void;
}

export const CreateEnvironmentModal = ({
  isOpen,
  setIsOpen,
  environments,
  onEnvironmentChange,
  setSelectedEnvironment,
}: EnvironmentVariableEditorProps) => {
  const [title, setTitle] = useState('');
  const [isValid, setValid] = useState(false);

  const newEnvironment = () => {
    const newEnvironmentName = title ?? (Math.random() + 1).toString(36).substring(7);
    setIsOpen(false);
    const updatedEnvironment = {
      ...environments,
      [newEnvironmentName]: {},
    } as EnvironmentMap;
    onEnvironmentChange(updatedEnvironment);
    setSelectedEnvironment(newEnvironmentName);
  };

  useEffect(() => {
    setValid(title.trim().length > 0);
  }, [title]);

  return (
    <NamingModal
      open={isOpen}
      onOpenChange={setIsOpen}
      modalTitle={'Create a new environment'}
      onSubmit={() => newEnvironment()}
      onReset={() => {
        setIsOpen(false);
        setTitle('');
      }}
      value={title}
      onChange={(value) => setTitle(value)}
      placeholder={'Enter the environment name'}
      valid={isValid}
    />
  );
};
