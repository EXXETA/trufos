import '@/styles/tailwind.css';
import { createRoot } from 'react-dom/client';
import { App } from '@/App';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { useCollectionStore } from '@/state/collectionStore';
import { TrufosRequest } from 'shim/objects/request';
import './lib/monaco/language';

import('@/lib/monaco/config'); // lazy load monaco editor to improve startup time

const { initialize } = useCollectionStore.getState();
console.info('Initializing renderer process...');

document.getElementById('body')?.classList.add('dark');

const container = document.getElementById('root');
const root = createRoot(container);

RendererEventService.instance.loadCollection().then((collection) => {
  initialize(collection);
  root.render(<App />);
});
