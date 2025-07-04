import { toast } from '@/components/ui/sonner';
import { DisplayableError } from './DisplayableError';

export function handleError(error: unknown) {
  const toastOptions = {
    style: { backgroundColor: '#E36873', color: 'black' },
  };

  if (error instanceof DisplayableError) {
    toast.error(error.description || 'An error occurred', toastOptions);
    console.error(error);
  } else {
    toast.error('An unexpected error occurred', toastOptions);
    console.error(error);
  }
}
