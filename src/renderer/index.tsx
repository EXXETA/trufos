import '@/styles/tailwind.css';
import { createRoot } from 'react-dom/client';
import { App } from '@/App';
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { Provider } from 'react-redux';
import { store } from '@/state/store';

console.info('Initializing renderer process...');

document.getElementById('body')?.classList.add('dark');

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<Provider store={store}><App /></Provider>);

// load Monaco Editor
loader.config({ monaco });
