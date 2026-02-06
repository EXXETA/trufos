import '@/logging/console';
import { enableMapSet } from 'immer';
enableMapSet(); // immer support for Map and Set
import { createRoot } from 'react-dom/client';
import { App } from '@/App';
import winston from 'winston';

import('@/lib/monaco/config.js'); // lazy load monaco editor to improve startup time

console.info('Initializing renderer process...');

// declare global functions
declare global {
  interface Window {
    logger: winston.Logger;
  }
}

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);
