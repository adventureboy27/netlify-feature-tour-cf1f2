import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { useGameStore } from './state/store';
import './index.css';

// A handle on the store during development, so a headless run can drive
// twenty years of weeks without clicking anything. Stripped from production.
if (import.meta.env.DEV) {
  (window as unknown as { __store: typeof useGameStore }).__store = useGameStore;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
