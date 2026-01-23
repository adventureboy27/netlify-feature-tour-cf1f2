import { ParticleEffects } from '../utils/ParticleEffects.js';
import { CollisionDetector } from '../utils/CollisionDetector.js';

export class ExplosionSystem {
  constructor(scene) {
    this.scene = scene;
  }

  explode(x, y, radius, damage, junkGroups, bombs) {
    // Create explosion effect
    ParticleEffects.createExplosion(this.scene, x, y, radius);

    // Get all junk pieces in explosion radius
    const allJunk = [];
    junkGroups.forEach(group => {
      allJunk.push(...group.getChildren());
    });

    const objectsInRadius = CollisionDetector.getObjectsInRadius(x, y, radius, allJunk);

    // Damage each object
    const destroyed = [];
    objectsInRadius.forEach(({ object, distance }) => {
      // Damage falls off with distance
      const damageMultiplier = 1 - (distance / radius);
      const actualDamage = Math.floor(damage * damageMultiplier);

      const isDestroyed = object.takeDamage(actualDamage);
      if (isDestroyed) {
        destroyed.push(object);
      }
    });

    return destroyed;
  }

  handleChainReactions(destroyedJunk, junkGroups, bombs) {
    const explosions = [];
    const fires = [];

    destroyedJunk.forEach(junk => {
      if (junk.junkData.explosive) {
        const explosionData = junk.explode();
        explosions.push(explosionData);
      }

      if (junk.junkData.flammable) {
        fires.push({ x: junk.x, y: junk.y });
      }
    });

    // Process explosions
    const furtherDestroyed = [];
    explosions.forEach(exp => {
      const destroyed = this.explode(exp.x, exp.y, exp.radius, exp.damage, junkGroups, bombs);
      furtherDestroyed.push(...destroyed);
    });

    return { explosions, fires, furtherDestroyed };
  }
}
