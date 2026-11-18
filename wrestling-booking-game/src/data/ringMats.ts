// The canvas on a professional ring (or better): what colour the company has
// it printed. Only how the ring looks — it is not rated — so changing it is
// free, and each show records the one it had (Show.staging.mat).

export interface RingMat {
  id: string;
  name: string;
  /** The canvas, far edge to near edge. Null: the company's own colour. */
  canvas: [string, string] | null;
  /** Dark canvas: lettering and lines on it go light. */
  dark: boolean;
}

export const RING_MATS: RingMat[] = [
  { id: 'classic', name: 'Classic white', canvas: ['#bcc1cc', '#e3e6ec'], dark: false },
  { id: 'midnight', name: 'Midnight blue', canvas: ['#0f1c3d', '#1f3a78'], dark: true },
  { id: 'blackout', name: 'Blackout', canvas: ['#0b0b0e', '#24252b'], dark: true },
  { id: 'crimson', name: 'Crimson', canvas: ['#4a0910', '#8f1520'], dark: true },
  { id: 'royal', name: 'Royal purple', canvas: ['#2a0f45', '#55208a'], dark: true },
  { id: 'emerald', name: 'Emerald', canvas: ['#06301f', '#0f6a43'], dark: true },
  { id: 'steel', name: 'Steel', canvas: ['#4b5563', '#8b95a5'], dark: true },
  { id: 'company', name: 'Company colour', canvas: null, dark: true },
];

export const ringMatById = (id: string | undefined | null): RingMat => RING_MATS.find((m) => m.id === id) ?? RING_MATS[0]!;
