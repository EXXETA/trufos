import { InputTabs } from '@/components/mainWindow/bodyTabs/InputTabs/InputTabs';
import { OutputTabs } from '@/components/mainWindow/bodyTabs/OutputTabs';

export function MainBody() {
  return (
    <div className="h-full grid grid-cols-2 gap-6">
      <InputTabs className="rounded-sm m-0" />
      <OutputTabs className="rounded-sm m-0" />
    </div>
  );
}
