import '@/logging/console';
import { enableMapSet } from 'immer';

enableMapSet();

import '@/styles/tailwind.css';
import { createRoot } from 'react-dom/client';
import { App } from '@/App';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { useCollectionStore } from '@/state/collectionStore';
import winston from 'winston';

import('@/lib/monaco/config.js'); // lazy load monaco editor to improve startup time

// set up store
const { initialize } = useCollectionStore.getState();
console.info('Initializing renderer process...');

// declare global functions
declare global {
  interface Window {
    logger: winston.Logger;
  }
}

const container = document.getElementById('root');
const root = createRoot(container);

// load collection and render app
RendererEventService.instance.loadCollection().then((collection) => {
  initialize(collection);
  root.render(<App />);
});
