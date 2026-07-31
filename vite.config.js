import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  server: { port: 5173 },
  build: {
    // three.js is the bulk of the bundle and changes far less often than app code — its own
    // chunk means a gameplay-only deploy doesn't force players to redownload it.
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three']
        }
      }
    }
  }
});
