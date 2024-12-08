import { InputTabs } from '@/components/mainWindow/bodyTabs/InputTabs';
import { OutputTabs } from '@/components/mainWindow/bodyTabs/OutputTabs';

export function MainBody() {
  return (
    <div className={'flex-1 flex flex-row gap-6'}>
      <InputTabs className="rounded-sm m-0 flex-1 flex" />
      <OutputTabs className="rounded-sm m-0 flex-1 flex" />
    </div>
  );
}
