import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Every sprite sheet has stayed under Vite's default 4KB auto-inline
    // limit by luck rather than by the `?inline` query actually forcing
    // anything (confirmed: it does not, in this Vite version — an asset
    // over the limit keeps a real /assets/... URL with an inert `?inline`
    // suffix, which is dead weight when hosted and a broken image when
    // folded into the single offline file, since file:// has no server to
    // resolve that URL against). Raised well past the title logo's ~360KB
    // so it inlines the same way the atlas already does, keeping `npm run
    // play`'s single-file output actually single-file.
    assetsInlineLimit: 1_000_000,
  },
});
