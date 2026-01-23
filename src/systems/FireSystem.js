import { CollisionDetector } from '../utils/CollisionDetector.js';

export class FireSystem {
  constructor(scene) {
    this.scene = scene;
    this.burningObjects = new Set();
  }

  ignite(x, y, junkGroups) {
    // Find junk at or near the impact point
    const allJunk = [];
    junkGroups.forEach(group => {
      allJunk.push(...group.getChildren());
    });

    const objectsInRadius = CollisionDetector.getObjectsInRadius(x, y, 30, allJunk);

    objectsInRadius.forEach(({ object }) => {
      if (object.junkData.flammable && !object.burning) {
        object.setOnFire();
        this.burningObjects.add(object);
      }
    });
  }

  update(delta, junkGroups) {
    const destroyed = [];

    this.burningObjects.forEach(junk => {
      if (!junk.active) {
        this.burningObjects.delete(junk);
        return;
      }

      const isDestroyed = junk.updateBurn(delta);
      if (isDestroyed) {
        destroyed.push(junk);
        this.burningObjects.delete(junk);
      } else {
        // Spread fire to nearby flammable objects every 2 seconds
        if (junk.burnTimer === 0) {
          this.spreadFire(junk, junkGroups);
        }
      }
    });

    return destroyed;
  }

  spreadFire(burningJunk, junkGroups) {
    const allJunk = [];
    junkGroups.forEach(group => {
      allJunk.push(...group.getChildren());
    });

    const objectsInRadius = CollisionDetector.getObjectsInRadius(
      burningJunk.x,
      burningJunk.y,
      60,
      allJunk
    );

    objectsInRadius.forEach(({ object }) => {
      if (object !== burningJunk && object.junkData.flammable && !object.burning) {
        // 30% chance to spread
        if (Math.random() < 0.3) {
          object.setOnFire();
          this.burningObjects.add(object);
        }
      }
    });
  }

  clear() {
    this.burningObjects.clear();
  }
}
