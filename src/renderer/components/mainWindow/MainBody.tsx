import { InputTabs } from '@/components/mainWindow/bodyTabs/InputTabs';
import { OutputTabs } from '@/components/mainWindow/bodyTabs/OutputTabs';

export function MainBody() {
  return (
    <div className={'xl:flex-1 overflow-x-hidden xl:flex xl:flex-column gap-6'}>
      <InputTabs className="rounded-sm m-0 flex-1" />
      <OutputTabs className="rounded-sm xl:m-0 mt-6 flex-1" />
    </div>
  );
}
