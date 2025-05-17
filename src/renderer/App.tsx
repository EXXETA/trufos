import '@/styles/tailwind.css';
import '@/styles/global.css';
import { Menubar } from '@/view/Menubar';
import { RequestWindow } from '@/view/RequestWindow';
import { SidebarProvider } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';

export const App = () => {
  return (
    <TooltipProvider delayDuration={750}>
      <SidebarProvider className="grid grid-cols-[1fr_3fr]">
        <Menubar />
        <RequestWindow />
      </SidebarProvider>
    </TooltipProvider>
  );
};
