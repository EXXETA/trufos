import { defineConfig } from 'vite';
import path from 'node:path';

// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    alias: {
      main: path.join(__dirname, 'src', 'main'),
      shim: path.join(__dirname, 'src', 'shim'),
    },
  },
});
