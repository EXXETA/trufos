/// <reference types="vite/client" />

declare module 'virtual:monaco-workers' {
  const workers: {
    editor: string;
    typescript: string;
    json: string;
    css: string;
    html: string;
  };
  export default workers;
}
