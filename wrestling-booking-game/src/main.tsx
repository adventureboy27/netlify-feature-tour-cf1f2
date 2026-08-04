import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { loadAtlasSheets } from './ui/paperdoll/atlas/sheets';
import './index.css';

// Start decoding the wrestler sheets before React mounts — they're inlined in
// the bundle, so this is a decode with no network involved, and getting it
// underway early means the first roster screen paints with sprites already in.
// Errors are reported by useAtlasSheets, which subscribes to this same
// memoized promise; swallow here only so priming it can't raise an unhandled
// rejection before the first doll mounts.
void loadAtlasSheets().catch(() => {});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
