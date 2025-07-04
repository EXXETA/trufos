import '@/styles/tailwind.css';
import '@/styles/global.css';
import { Menubar } from '@/view/Menubar';
import { RequestWindow } from '@/view/RequestWindow';
import { SidebarProvider } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ResizablePanel, ResizablePanelGroup, ResizableHandle } from '@/components/ui/resizable';
import { useEffect, useState } from 'react';

const MIN_SIDEBAR_PIXELS = 300;
const MIN_REQUEST_WINDOW_PIXELS = 500;

export const App = () => {
  const [minSidebarSize, setMinSidebarSize] = useState(0);
  const [minRequestWindowSize, setMinRequestWindowSize] = useState(0);

  useEffect(() => {
    const updateMinResizableSizes = () => {
      const minSidebarSize = (MIN_SIDEBAR_PIXELS / window.innerWidth) * 100;
      const minRequestWindowSize = (MIN_REQUEST_WINDOW_PIXELS / window.innerWidth) * 100;

      setMinSidebarSize(minSidebarSize);
      setMinRequestWindowSize(minRequestWindowSize);
    };

    updateMinResizableSizes();
    window.addEventListener('resize', updateMinResizableSizes);

    return () => {
      window.removeEventListener('resize', updateMinResizableSizes);
    };
  }, []);

  return (
    <>
      <TooltipProvider delayDuration={750}>
        <SidebarProvider className="grid">
          <ResizablePanelGroup direction="horizontal" className="h-full w-full">
            <ResizablePanel defaultSize={minSidebarSize} minSize={minSidebarSize}>
              <Menubar />
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel minSize={minRequestWindowSize}>
              <RequestWindow />
            </ResizablePanel>
          </ResizablePanelGroup>
        </SidebarProvider>
      </TooltipProvider>
    </>
  );
};
