import '@/styles/tailwind.css';
import '@/styles/global.css';
import { Menubar } from '@/view/Menubar';
import { RequestWindow } from '@/view/RequestWindow';
import { SidebarProvider } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ResizablePanel, ResizablePanelGroup, ResizableHandle } from '@/components/ui/resizable';

export const App = () => {
  return (
    <TooltipProvider delayDuration={750}>
      <SidebarProvider className="grid">
        <ResizablePanelGroup direction="horizontal" className="h-full w-full">
          <ResizablePanel defaultSize={25} minSize={25}>
            <Menubar />
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize={75}>
            <RequestWindow />
          </ResizablePanel>
        </ResizablePanelGroup>
      </SidebarProvider>
    </TooltipProvider>
  );
};
