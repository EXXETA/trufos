import "@/styles/tailwind.css";
import {createRoot} from 'react-dom/client';
import {App} from "@/App";
import {loader} from "@monaco-editor/react";
import * as monaco from "monaco-editor";

console.info('Initializing renderer process...');

document.getElementById('body')?.classList.add('dark')

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App/>);

// load Monaco Editor
loader.config({monaco});
