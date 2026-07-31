import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  server: { port: 5173 },
  // GitHub Pages serves project sites from /<repo-name>/, not /, so every asset URL needs
  // that prefix baked in — but only for that build; local dev and other hosts stay at root.
  base: process.env.GH_PAGES ? '/netlify-feature-tour-cf1f2/' : '/',
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
