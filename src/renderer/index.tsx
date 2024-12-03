import '@/styles/tailwind.css';
import { createRoot } from 'react-dom/client';
import { App } from '@/App';
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { useRequestStore } from '@/state/requestStore';
import { TrufosRequest } from '../shim/objects/request';

const { initialize } = useRequestStore.getState();
console.info('Initializing renderer process...');

document.getElementById('body')?.classList.add('dark');

const container = document.getElementById('root');
const root = createRoot(container);

// load Monaco Editor
loader.config({ monaco });

RendererEventService.instance.loadCollection().then((collection) => {
  const requests = collection.children.filter((c) => c.type === 'request') as TrufosRequest[];
  initialize({ requests, collectionId: collection.id });
  root.render(<App />);
});
