import Phaser from 'phaser';

export class Projectile extends Phaser.GameObjects.Arc {
  constructor(scene, x, y, weapon, angle, power, wind) {
    super(scene, x, y, 5, 0, 360, false, 0xFFFFFF);

    this.weapon = weapon;
    this.angle = angle;
    this.power = power;
    this.wind = wind;

    // Set color based on weapon type
    if (weapon.fire) {
      this.setFillStyle(0xFF6600);
    } else if (weapon.explosive) {
      this.setFillStyle(0xFF0000);
    } else {
      this.setFillStyle(0x333333);
    }

    // Enable physics
    scene.physics.world.enable(this);

    // Calculate initial velocity
    const radians = Phaser.Math.DegToRad(angle);
    const speedMultiplier = power / 100;
    const velocityX = Math.cos(radians) * weapon.speed * speedMultiplier * 100;
    const velocityY = -Math.sin(radians) * weapon.speed * speedMultiplier * 100 * weapon.arc;

    this.body.setVelocity(velocityX, velocityY);
    this.body.setGravityY(weapon.arc * 200); // Adjust gravity based on arc

    // Add wind effect
    this.body.setVelocityX(velocityX + wind * 5);

    // Create trail
    this.trail = scene.add.graphics();
    this.previousPositions = [];

    this.active = true;

    scene.add.existing(this);
  }

  update() {
    if (!this.active) return;

    // Store position for trail
    this.previousPositions.push({ x: this.x, y: this.y });
    if (this.previousPositions.length > 20) {
      this.previousPositions.shift();
    }

    // Draw trail
    this.trail.clear();
    this.trail.lineStyle(2, this.fillColor, 0.5);
    if (this.previousPositions.length > 1) {
      this.trail.beginPath();
      this.trail.moveTo(this.previousPositions[0].x, this.previousPositions[0].y);
      for (let i = 1; i < this.previousPositions.length; i++) {
        this.trail.lineTo(this.previousPositions[i].x, this.previousPositions[i].y);
      }
      this.trail.strokePath();
    }

    // Check if out of bounds
    if (this.y > 600 || this.x < -50 || this.x > 850) {
      this.deactivate();
    }
  }

  deactivate() {
    this.active = false;
    this.body.setVelocity(0, 0);
  }

  destroy() {
    if (this.trail) {
      this.trail.destroy();
    }
    super.destroy();
  }
}
