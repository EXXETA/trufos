import { InputTabs } from '@/components/mainWindow/bodyTabs/InputTabs/InputTabs';
import { OutputTabs } from '@/components/mainWindow/bodyTabs/OutputTabs';

export function MainBody() {
  return (
    <div className="flex h-full flex-col gap-6 xl:flex-row">
      <InputTabs className="flex min-h-0 min-w-0 flex-1 flex-col" />
      <OutputTabs className="flex min-h-0 min-w-0 flex-1 flex-col" />
    </div>
  );
}
