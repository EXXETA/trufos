import * as React from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSendRequest } from '@/hooks/request/useRequestActions';

/**
 * Sends the selected request. While that request is in flight the button turns into a cancel
 * button that aborts it.
 */
export const SendButton: React.FC = () => {
  const { sendRequest, cancelRequest, isSending } = useSendRequest();

  return (
    <Button
      className="gap-3 pl-7.5"
      onClick={isSending ? cancelRequest : sendRequest}
      variant="secondary"
    >
      <span className="leading-4 font-bold">{isSending ? 'Cancel' : 'Send'}</span>

      {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight />}
    </Button>
  );
};
