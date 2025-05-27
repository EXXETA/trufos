import { InputTabs } from '@/components/mainWindow/bodyTabs/InputTabs/InputTabs';
import { OutputTabs } from '@/components/mainWindow/bodyTabs/OutputTabs';

export function MainBody() {
  return (
    <div className="flex flex-col xl:flex-row h-full gap-6">
      <InputTabs className="flex flex-col flex-1 min-h-0 min-w-0" />
      <OutputTabs className="flex flex-col flex-1 min-h-0 min-w-0" />
    </div>
  );
}
