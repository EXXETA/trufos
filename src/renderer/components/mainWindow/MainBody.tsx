import { InputTabs } from '@/components/mainWindow/bodyTabs/InputTabs/InputTabs';
import { OutputTabs } from '@/components/mainWindow/bodyTabs/OutputTabs';

export function MainBody() {
  return (
    <div className="grid h-full grid-rows-[48%_48%] gap-6 xl:grid-cols-2 xl:grid-rows-1">
      <InputTabs className="min-h-0 min-w-0" />
      <OutputTabs className="min-h-0 min-w-0" />
    </div>
  );
}
