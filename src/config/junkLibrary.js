// 12 types of junk pieces with their properties
export const JUNK_LIBRARY = [
  {
    name: 'Gas Can',
    hp: 25,
    size: 'small',
    width: 30,
    height: 40,
    flammable: true,
    explosive: true,
    emoji: '⛽',
    color: 0xff0000
  },
  {
    name: 'Tire',
    hp: 45,
    size: 'medium',
    width: 50,
    height: 50,
    flammable: true,
    emoji: '🛞',
    color: 0x333333
  },
  {
    name: 'Barrel',
    hp: 50,
    size: 'medium',
    width: 45,
    height: 60,
    solid: true,
    emoji: '🛢️',
    color: 0x8B4513
  },
  {
    name: 'Crate',
    hp: 35,
    size: 'medium',
    width: 50,
    height: 50,
    flammable: true,
    emoji: '📦',
    color: 0xD2691E
  },
  {
    name: 'Fridge',
    hp: 80,
    size: 'large',
    width: 60,
    height: 80,
    solid: true,
    heavy: true,
    emoji: '🧊',
    color: 0xE0E0E0
  },
  {
    name: 'Propane Tank',
    hp: 40,
    size: 'medium',
    width: 40,
    height: 55,
    explosive: true,
    flammable: true,
    emoji: '🧯',
    color: 0xFF4500
  },
  {
    name: 'Car Battery',
    hp: 30,
    size: 'small',
    width: 35,
    height: 30,
    explosive: true,
    emoji: '🔋',
    color: 0x4169E1
  },
  {
    name: 'Metal Sheet',
    hp: 70,
    size: 'large',
    width: 70,
    height: 50,
    solid: true,
    emoji: '🔩',
    color: 0x708090
  },
  {
    name: 'Wood Planks',
    hp: 30,
    size: 'medium',
    width: 55,
    height: 45,
    flammable: true,
    emoji: '🪵',
    color: 0x8B7355
  },
  {
    name: 'Engine Block',
    hp: 90,
    size: 'large',
    width: 65,
    height: 70,
    heavy: true,
    solid: true,
    emoji: '⚙️',
    color: 0x2F4F4F
  },
  {
    name: 'Paint Can',
    hp: 20,
    size: 'small',
    width: 30,
    height: 35,
    flammable: true,
    emoji: '🎨',
    color: 0xFF69B4
  },
  {
    name: 'Safe',
    hp: 100,
    size: 'large',
    width: 60,
    height: 75,
    heavy: true,
    solid: true,
    emoji: '🔒',
    color: 0x556B2F
  }
];

// Get 10 random junk pieces for a player
export function getRandomJunk() {
  const shuffled = [...JUNK_LIBRARY].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 10).map((junk, index) => ({
    ...junk,
    id: `junk_${Date.now()}_${index}`,
    currentHp: junk.hp,
    burning: false,
    burnTimer: 0
  }));
}
