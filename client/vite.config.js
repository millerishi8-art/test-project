import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000', // Server listens on 0.0.0.0:5000
        changeOrigin: true,
        secure: false
      }
    }
  }
});
