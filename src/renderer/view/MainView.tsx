import type { ReactElement } from 'react';
import { useDefaultLayout } from 'react-resizable-panels';
import { CollectionTrustBanner } from '@/components/mainWindow/CollectionTrustBanner';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { selectWindowView, useViewActions, useViewStore } from '@/state/viewStore';
import { CollectionRunner } from '@/view/CollectionRunner';
import { Menubar } from '@/view/Menubar';
import { RequestWindow } from '@/view/RequestWindow';

const MIN_SIDEBAR_PIXELS = 300;
const MIN_REQUEST_WINDOW_PIXELS = 500;

/** The sidebar and the request window, side by side. */
function RequestLayout(): ReactElement {
  const layout = useDefaultLayout({ id: 'trufos.main' });
  return (
    <ResizablePanelGroup
      orientation="horizontal"
      className="h-full w-full"
      defaultLayout={layout.defaultLayout}
      onLayoutChanged={layout.onLayoutChanged}
    >
      <ResizablePanel id="sidebar" defaultSize="25%" minSize={MIN_SIDEBAR_PIXELS}>
        <Menubar />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel id="request" defaultSize="75%" minSize={MIN_REQUEST_WINDOW_PIXELS}>
        <RequestWindow />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

/** The view selected in the view store, see `WindowView`. */
function WindowContent(): ReactElement {
  const windowView = useViewStore(selectWindowView);
  const { closeCollectionRunner } = useViewActions();
  switch (windowView) {
    case 'requests':
      return <RequestLayout />;
    case 'runner':
      // full width, as its own request checklist makes the sidebar redundant
      return <CollectionRunner onClose={closeCollectionRunner} />;
  }
}

/**
 * The content of the window. The trust banner is shown above whatever view is open, as trust is a
 * property of the collection.
 */
export function MainView(): ReactElement {
  return (
    <div className="flex h-full w-full flex-col">
      <CollectionTrustBanner />
      <div className="min-h-0 flex-1">
        <WindowContent />
      </div>
    </div>
  );
}
