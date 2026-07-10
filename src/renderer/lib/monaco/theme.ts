import { editor } from 'monaco-editor';

editor.defineTheme('trufos-light', {
  base: 'vs',
  inherit: true,
  rules: [
    {
      token: 'string.key.json',
      foreground: '#b91fc7',
    },
    {
      token: 'string.value.json',
      foreground: '#00629a',
    },
    {
      token: 'keyword.json',
      foreground: '#2f9315',
    },
    {
      token: 'number.json',
      foreground: '#263e4c',
    },
  ],
  colors: {
    'editor.background': '#f2f3f5', // Match sidebar background
    'editor.foreground': '#263e4c',
    'editor.lineNumbersContainerBackground': '#f8f9fb',
  },
});

editor.defineTheme('trufos-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [],
  colors: {
    'editor.background': '#1f1f1f', // Match sidebar background
    'editor.foreground': '#eeeeee',
    'editor.lineNumbersContainerBackground': '#111111',
  },
});
