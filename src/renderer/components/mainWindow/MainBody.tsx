import { InputTabs } from '@/components/mainWindow/bodyTabs/InputTabs';
import { OutputTabs } from '@/components/mainWindow/bodyTabs/OutputTabs';
import { HttpHeaders } from '../../../shim/headers';

export type RequestBodyProps = {
  headers?: HttpHeaders;
  body?: string;
};

export function MainBody(props: RequestBodyProps) {
  const { body, headers } = props;

  return (
    <div className={'flex-1 grid grid-cols-2 gap-6'}>
      <div className="rounded-sm m-0">
        <InputTabs />
      </div>
      <div className="rounded-sm m-0">
        <OutputTabs body={body} headers={headers} />
      </div>
    </div>
  );
}
