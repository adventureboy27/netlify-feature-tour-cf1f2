// 8 weapon types with their properties
export const WEAPONS = [
  {
    id: 'slingshot',
    name: 'Slingshot',
    damage: 10,
    ammo: Infinity,
    maxAmmo: Infinity,
    speed: 6,
    arc: 1.0,
    emoji: '🎯'
  },
  {
    id: 'pistol',
    name: 'Pistol',
    damage: 20,
    ammo: 15,
    maxAmmo: 15,
    speed: 10,
    arc: 0.4,
    emoji: '🔫'
  },
  {
    id: 'rifle',
    name: 'Rifle',
    damage: 30,
    ammo: 10,
    maxAmmo: 10,
    speed: 14,
    arc: 0.3,
    emoji: '🎯'
  },
  {
    id: 'shotgun',
    name: 'Shotgun',
    damage: 45,
    ammo: 6,
    maxAmmo: 6,
    speed: 8,
    arc: 0.6,
    spread: 3,
    emoji: '💥'
  },
  {
    id: 'grenade',
    name: 'Grenade',
    damage: 50,
    ammo: 3,
    maxAmmo: 3,
    speed: 5,
    arc: 1.8,
    explosive: true,
    radius: 60,
    emoji: '💣'
  },
  {
    id: 'molotov',
    name: 'Molotov',
    damage: 25,
    ammo: 5,
    maxAmmo: 5,
    speed: 4,
    arc: 1.5,
    fire: true,
    emoji: '🔥'
  },
  {
    id: 'rpg',
    name: 'RPG',
    damage: 80,
    ammo: 2,
    maxAmmo: 2,
    speed: 12,
    arc: 0.5,
    explosive: true,
    radius: 80,
    emoji: '🚀'
  },
  {
    id: 'flamethrower',
    name: 'Flamethrower',
    damage: 35,
    ammo: 8,
    maxAmmo: 8,
    speed: 3,
    arc: 0.2,
    fire: true,
    emoji: '🔥'
  }
];
