import '@/styles/tailwind.css';
import { createRoot } from 'react-dom/client';
import { App } from '@/App';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { useRequestStore } from '@/state/requestStore';
import { TrufosRequest } from 'shim/objects/request';

import('@/lib/monaco/config'); // lazy load monaco editor to improve startup time

const { initialize } = useRequestStore.getState();
console.info('Initializing renderer process...');

declare global {
  function joinClassNames(...classNames: string[]): string;
}

globalThis.joinClassNames = (...classNames: string[]) => classNames.join(' ');

document.getElementById('body')?.classList.add('dark');

const container = document.getElementById('root');
const root = createRoot(container);

RendererEventService.instance.loadCollection().then((collection) => {
  const requests = collection.children.filter((c) => c.type === 'request') as TrufosRequest[];
  initialize({ requests, collectionId: collection.id });
  root.render(<App />);
});
