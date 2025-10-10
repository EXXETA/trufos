import { toast } from '@/components/ui/sonner';
import { DisplayableError } from './DisplayableError';

export function showError(error: unknown) {
  const toastOptions = {
    style: { backgroundColor: 'var(--error)', color: 'var(--text-primary)' },
  };

  if (error instanceof DisplayableError) {
    toast.error(error.description || 'An error occurred', toastOptions);
    console.error(error);
  } else {
    toast.error('An unexpected error occurred', toastOptions);
    console.error(error);
  }
}
