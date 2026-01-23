export class PhysicsManager {
  constructor(scene) {
    this.scene = scene;
    this.wind = 0;
  }

  generateWind() {
    // Wind between -15 and +15 mph
    this.wind = Phaser.Math.Between(-15, 15);
    return this.wind;
  }

  getWind() {
    return this.wind;
  }

  applyWindToProjectile(projectile) {
    if (projectile.body) {
      projectile.body.velocity.x += this.wind * 0.5;
    }
  }
}
