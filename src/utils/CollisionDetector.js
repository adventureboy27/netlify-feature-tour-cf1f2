export class CollisionDetector {
  static checkProjectileCollisions(scene, projectile, junkGroup, bombs) {
    if (!projectile.active) return null;

    // Check collision with junk
    for (let junk of junkGroup.getChildren()) {
      if (this.checkCollision(projectile, junk)) {
        return { type: 'junk', target: junk, x: projectile.x, y: projectile.y };
      }
    }

    // Check collision with bombs
    for (let bomb of bombs) {
      const distance = Phaser.Math.Distance.Between(projectile.x, projectile.y, bomb.x, bomb.y);
      if (distance < 35) {
        return { type: 'bomb', target: bomb, x: projectile.x, y: projectile.y };
      }
    }

    // Check collision with ground
    if (projectile.y >= 500) {
      return { type: 'ground', x: projectile.x, y: 500 };
    }

    return null;
  }

  static checkCollision(obj1, obj2) {
    const bounds1 = obj1.getBounds ? obj1.getBounds() : {
      x: obj1.x - 5,
      y: obj1.y - 5,
      width: 10,
      height: 10
    };

    const bounds2 = obj2.getBounds();

    return Phaser.Geom.Intersects.RectangleToRectangle(
      new Phaser.Geom.Rectangle(bounds1.x, bounds1.y, bounds1.width, bounds1.height),
      new Phaser.Geom.Rectangle(bounds2.x, bounds2.y, bounds2.width, bounds2.height)
    );
  }

  static getObjectsInRadius(x, y, radius, objects) {
    const inRadius = [];
    for (let obj of objects) {
      const distance = Phaser.Math.Distance.Between(x, y, obj.x, obj.y);
      if (distance <= radius) {
        inRadius.push({ object: obj, distance });
      }
    }
    return inRadius;
  }
}
