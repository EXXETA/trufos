import { useState } from 'react';
import { Input } from './input';

interface SecretInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  secret?: boolean;
}

export function SecretInput({ secret = true, className, ...props }: SecretInputProps) {
  const [show, setShow] = useState(false);

  if (!secret) {
    return <Input type="text" className={className} {...props} />;
  }

  return (
    <div className="relative w-full">
      <Input type={show ? 'text' : 'password'} className={className} {...props} />
      <button
        type="button"
        className="absolute inset-y-0 right-0 flex items-center px-3 text-sm text-text-secondary hover:text-text-primary"
        onClick={() => setShow((prev) => !prev)}
        tabIndex={-1}
      >
        {show ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}
SecretInput.displayName = 'SecretInput';
