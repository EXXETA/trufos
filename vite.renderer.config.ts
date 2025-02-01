import { defineConfig } from 'vite';
import PluginReact from '@vitejs/plugin-react';
import path from 'node:path';

// https://vitejs.dev/config
export default defineConfig({
  plugins: [PluginReact()],
  resolve: {
    alias: {
      '@': path.join(__dirname, 'src', 'renderer'),
      shim: path.join(__dirname, 'src', 'shim'),
    },
  },
});
