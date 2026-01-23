import { WEAPONS } from '../config/weaponsConfig.js';

export class Player {
  constructor(id, name, side) {
    this.id = id; // 1 or 2
    this.name = name;
    this.side = side; // 'left' or 'right'
    this.junkPieces = [];
    this.weapons = this.initializeWeapons();
    this.selectedWeapon = this.weapons[0]; // Start with slingshot
    this.shotsRemaining = 0;
  }

  initializeWeapons() {
    return WEAPONS.map(weapon => ({
      ...weapon,
      ammo: weapon.maxAmmo
    }));
  }

  selectWeapon(weaponId) {
    const weapon = this.weapons.find(w => w.id === weaponId);
    if (weapon && weapon.ammo > 0) {
      this.selectedWeapon = weapon;
      return true;
    }
    return false;
  }

  useAmmo() {
    if (this.selectedWeapon.ammo !== Infinity) {
      this.selectedWeapon.ammo--;
    }
    this.shotsRemaining--;
  }

  hasAmmo() {
    return this.selectedWeapon.ammo > 0;
  }

  resetShots(count) {
    this.shotsRemaining = count;
  }

  getWeaponById(weaponId) {
    return this.weapons.find(w => w.id === weaponId);
  }
}
