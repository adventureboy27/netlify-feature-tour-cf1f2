// Same trick as skinTones.ts, for hair and facial hair: one drawn shape,
// recolored in code, so a hairstyle file is painted once rather than once
// per color. See ComposedPortrait.tsx for how the tint is applied.
export interface HairColor {
  id: string;
  label: string;
  color: string;
}

export const HAIR_COLORS: readonly HairColor[] = [
  { id: 'black', label: 'Black', color: '#1c1712' },
  { id: 'darkBrown', label: 'Dark brown', color: '#3a2a1c' },
  { id: 'brown', label: 'Brown', color: '#5a3e28' },
  { id: 'blond', label: 'Blond', color: '#c9a25e' },
  { id: 'red', label: 'Red', color: '#8a3a24' },
  { id: 'grey', label: 'Grey', color: '#8a8580' },
  { id: 'white', label: 'White/bleached', color: '#e8e2d4' },
];
