import { InputTabs } from '@/components/mainWindow/bodyTabs/InputTabs';
import { OutputTabs } from '@/components/mainWindow/bodyTabs/OutputTabs';

export function MainBody() {
  return (
    <div className={'flex-1 grid grid-cols-2 gap-6'}>
      <div className="rounded-sm m-0">
        <InputTabs />
      </div>
      <div className="rounded-sm m-0">
        <OutputTabs />
      </div>
    </div>
  );
}
