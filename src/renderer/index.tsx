import '@/styles/tailwind.css';
import { createRoot } from 'react-dom/client';
import { App } from '@/App';
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { Provider } from 'react-redux';
import { store } from '@/state/store';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { setRequests } from '@/state/requestsSlice';
import { RufusRequest } from '../shim/objects/request';

console.info('Initializing renderer process...');

document.getElementById('body')?.classList.add('dark');

const container = document.getElementById('root');
const root = createRoot(container);

// load Monaco Editor
loader.config({ monaco });

RendererEventService.instance.loadCollection().then(collection => {
  const requests = collection.children.filter(c => c.type === 'request') as RufusRequest[];
  store.dispatch(setRequests(requests));
  root.render(<Provider store={store}><App /></Provider>);
});

