import type { editor } from 'monaco-editor';

export const styleMonacoScrollbar = (editor: editor.IStandaloneCodeEditor | null) => {
  if (!editor) return;

  const container = editor.getDomNode();
  if (!container) return;

  const scrollbarElements = container.querySelectorAll('.monaco-scrollable-element');
  scrollbarElements.forEach((el) => {
    (el as HTMLElement).style.borderRadius = '8px';
  });

  const scrollThumbs = container.querySelectorAll('.scrollbar > .slider');
  scrollThumbs.forEach((thumb) => {
    const thumbEl = thumb as HTMLElement;
    thumbEl.style.background = '#333';
    thumbEl.style.borderRadius = '4px';
  });
};
