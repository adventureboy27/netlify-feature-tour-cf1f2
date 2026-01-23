import Phaser from 'phaser';
import { BOMB_QUADRANT_HP, BOMB_CORE_HP, BOMB_RADIUS, BOMB_CORE_RADIUS } from '../config/gameConfig.js';

export class Bomb extends Phaser.GameObjects.Container {
  constructor(scene, x, y, playerSide) {
    super(scene, x, y);

    this.playerSide = playerSide; // 'left' or 'right'

    // Initialize quadrants and core HP
    this.quadrants = {
      topLeft: BOMB_QUADRANT_HP,
      topRight: BOMB_QUADRANT_HP,
      bottomLeft: BOMB_QUADRANT_HP,
      bottomRight: BOMB_QUADRANT_HP
    };
    this.coreHP = BOMB_CORE_HP;
    this.maxCoreHP = BOMB_CORE_HP;

    // Create visual representation
    this.graphics = scene.add.graphics();
    this.add(this.graphics);

    // Create HP text
    this.hpText = scene.add.text(0, -50, '', {
      fontSize: '16px',
      fill: '#fff',
      stroke: '#000',
      strokeThickness: 3,
      align: 'center'
    }).setOrigin(0.5);
    this.add(this.hpText);

    this.draw();

    scene.add.existing(this);
  }

  draw() {
    this.graphics.clear();

    const radius = BOMB_RADIUS;
    const coreRadius = BOMB_CORE_RADIUS;

    // Draw quadrants
    this.drawQuadrant(-radius/2, -radius/2, radius/2, radius/2, this.quadrants.topLeft, BOMB_QUADRANT_HP);
    this.drawQuadrant(0, -radius/2, radius/2, radius/2, this.quadrants.topRight, BOMB_QUADRANT_HP);
    this.drawQuadrant(-radius/2, 0, radius/2, radius/2, this.quadrants.bottomLeft, BOMB_QUADRANT_HP);
    this.drawQuadrant(0, 0, radius/2, radius/2, this.quadrants.bottomRight, BOMB_QUADRANT_HP);

    // Draw core
    const coreColor = this.getCoreColor();
    this.graphics.fillStyle(coreColor);
    this.graphics.fillCircle(0, 0, coreRadius);

    // Draw core outline
    this.graphics.lineStyle(2, 0x000000);
    this.graphics.strokeCircle(0, 0, coreRadius);

    // Update HP text
    this.hpText.setText(`Core: ${this.coreHP}/${this.maxCoreHP}`);
  }

  drawQuadrant(x, y, width, height, hp, maxHP) {
    const color = this.getQuadrantColor(hp, maxHP);
    this.graphics.fillStyle(color, 0.8);
    this.graphics.fillRect(x, y, width, height);
    this.graphics.lineStyle(1, 0x000000);
    this.graphics.strokeRect(x, y, width, height);
  }

  getQuadrantColor(hp, maxHP) {
    const percent = hp / maxHP;
    if (percent > 0.6) return 0x00FF00; // Green
    if (percent > 0.3) return 0xFFFF00; // Yellow
    return 0xFF0000; // Red
  }

  getCoreColor() {
    const percent = this.coreHP / this.maxCoreHP;
    if (percent > 0.6) return 0x00FF00;
    if (percent > 0.3) return 0xFFFF00;
    return 0xFF0000;
  }

  takeDamage(worldX, worldY, damage) {
    // Convert world coordinates to local coordinates
    const localX = worldX - this.x;
    const localY = worldY - this.y;

    const distance = Math.sqrt(localX * localX + localY * localY);

    // Direct core hit
    if (distance <= BOMB_CORE_RADIUS) {
      this.coreHP = Math.max(0, this.coreHP - damage);
      this.draw();
      return { type: 'core', damage };
    }

    // Quadrant hit
    if (distance <= BOMB_RADIUS) {
      const quadrant = this.getQuadrantFromPosition(localX, localY);
      if (quadrant && this.quadrants[quadrant] > 0) {
        const quadrantDamage = Math.min(damage, this.quadrants[quadrant]);
        this.quadrants[quadrant] = Math.max(0, this.quadrants[quadrant] - damage);

        // 30% damage bleeds to core
        const bleedDamage = Math.floor(damage * 0.3);
        this.coreHP = Math.max(0, this.coreHP - bleedDamage);

        this.draw();
        return { type: 'quadrant', quadrant, damage: quadrantDamage, bleedDamage };
      }
    }

    return null;
  }

  getQuadrantFromPosition(localX, localY) {
    if (localX < 0 && localY < 0) return 'topLeft';
    if (localX >= 0 && localY < 0) return 'topRight';
    if (localX < 0 && localY >= 0) return 'bottomLeft';
    if (localX >= 0 && localY >= 0) return 'bottomRight';
    return null;
  }

  isDestroyed() {
    return this.coreHP <= 0;
  }
}
