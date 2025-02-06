import { InputTabs } from '@/components/mainWindow/bodyTabs/InputTabs/InputTabs';
import { OutputTabs } from '@/components/mainWindow/bodyTabs/OutputTabs';

export function MainBody() {
  return (
    <div className={'flex-1 flex flex-column gap-6'}>
      <InputTabs className="rounded-sm m-0 flex-1" />
      <OutputTabs className="rounded-sm m-0 flex-1" />
    </div>
  );
}
