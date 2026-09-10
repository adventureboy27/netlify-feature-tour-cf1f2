// A locked set of skin tones, applied to the base body art in code rather
// than painted six separate times. See ComposedPortrait.tsx for how the tint
// is applied — it recolors whatever the base art already draws, so the art
// itself never needs to encode a skin color at all.

export interface SkinTone {
  id: string;
  label: string;
  color: string;
}

export const SKIN_TONES: readonly SkinTone[] = [
  { id: 'pale', label: 'Pale', color: '#e7c3a3' },
  { id: 'fair', label: 'Fair', color: '#d7ac80' },
  { id: 'olive', label: 'Olive', color: '#b98861' },
  { id: 'tan', label: 'Tan', color: '#a06a44' },
  { id: 'brown', label: 'Brown', color: '#7c4c2c' },
  { id: 'deepBrown', label: 'Deep brown', color: '#4c2f1d' },
];
