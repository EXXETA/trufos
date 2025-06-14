import { InputTabs } from '@/components/mainWindow/bodyTabs/InputTabs/InputTabs';
import { OutputTabs } from '@/components/mainWindow/bodyTabs/OutputTabs';

export function MainBody() {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(450px,1fr))] h-full gap-6">
      <InputTabs className="min-h-0 min-w-0" />
      <OutputTabs className="min-h-0 min-w-0" />
    </div>
  );
}
