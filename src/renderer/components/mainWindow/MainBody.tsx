import { InputTabs } from '@/components/mainWindow/bodyTabs/InputTabs/InputTabs';
import { OutputTabs } from '@/components/mainWindow/bodyTabs/OutputTabs';

export function MainBody() {
  return (
    <div className="grid grid-rows-[48%_48%] xl:grid-cols-2 xl:grid-rows-1 h-full gap-6">
      <InputTabs className="min-h-0 min-w-0" />
      <OutputTabs className="min-h-0 min-w-0" />
    </div>
  );
}
