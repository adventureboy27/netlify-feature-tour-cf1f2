// M1: paper-doll renderer + editor. Still no real navigation/state store —
// that's M2. This is just enough chrome to reach both M1 screens by hand.
import { useState } from 'react';
import { ContactSheet } from './ui/screens/ContactSheet';
import { WrestlerEditor } from './ui/screens/WrestlerEditor';

type Screen = 'contactSheet' | 'editor';

export default function App() {
  const [screen, setScreen] = useState<Screen>('contactSheet');

  return (
    <div className="min-h-screen bg-neutral-950">
      <nav className="flex gap-2 border-b border-neutral-800 bg-neutral-900 p-2">
        <button
          type="button"
          onClick={() => setScreen('contactSheet')}
          className={`rounded px-3 py-1.5 text-sm ${screen === 'contactSheet' ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300'}`}
        >
          Contact Sheet
        </button>
        <button
          type="button"
          onClick={() => setScreen('editor')}
          className={`rounded px-3 py-1.5 text-sm ${screen === 'editor' ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300'}`}
        >
          Wrestler Editor
        </button>
      </nav>
      {screen === 'contactSheet' ? <ContactSheet /> : <WrestlerEditor />}
    </div>
  );
}
