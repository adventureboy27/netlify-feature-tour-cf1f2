import Phaser from 'phaser';

export class Junk extends Phaser.GameObjects.Container {
  constructor(scene, x, y, data) {
    super(scene, x, y);

    this.junkData = data;
    this.currentHp = data.currentHp;
    this.maxHp = data.hp;
    this.burning = data.burning || false;
    this.burnTimer = 0;

    // Create visual box
    this.box = scene.add.rectangle(0, 0, data.width, data.height, data.color);
    this.add(this.box);

    // Create emoji text
    this.emoji = scene.add.text(0, 0, data.emoji, {
      fontSize: '24px'
    }).setOrigin(0.5);
    this.add(this.emoji);

    // Create HP bar background
    this.hpBarBg = scene.add.rectangle(0, -data.height/2 - 10, data.width, 6, 0x000000);
    this.add(this.hpBarBg);

    // Create HP bar
    this.hpBar = scene.add.rectangle(0, -data.height/2 - 10, data.width, 6, 0x00FF00);
    this.add(this.hpBar);

    // Create name text
    this.nameText = scene.add.text(0, data.height/2 + 5, data.name, {
      fontSize: '10px',
      fill: '#fff',
      stroke: '#000',
      strokeThickness: 2
    }).setOrigin(0.5);
    this.add(this.nameText);

    // Fire particles (initially invisible)
    this.fireParticles = null;

    // Enable physics
    scene.physics.world.enable(this);
    this.body.setSize(data.width, data.height);
    this.body.setImmovable(true);

    // Store draggable state
    this.isDraggable = false;

    scene.add.existing(this);
  }

  setDraggable(draggable, bounds = null) {
    this.isDraggable = draggable;
    if (draggable) {
      this.setInteractive({ draggable: true });
      this.scene.input.setDraggable(this);

      // Store bounds for constraint
      this.dragBounds = bounds;

      this.on('drag', (pointer, dragX, dragY) => {
        if (this.dragBounds) {
          dragX = Phaser.Math.Clamp(dragX, this.dragBounds.min, this.dragBounds.max);
        }
        // Keep within vertical bounds
        dragY = Phaser.Math.Clamp(dragY, 100, 480);

        this.x = dragX;
        this.y = dragY;
      });
    } else {
      this.removeInteractive();
    }
  }

  takeDamage(damage) {
    this.currentHp = Math.max(0, this.currentHp - damage);
    this.updateHPBar();
    return this.currentHp <= 0;
  }

  updateHPBar() {
    const percent = this.currentHp / this.maxHp;
    this.hpBar.scaleX = percent;

    // Change color based on HP
    if (percent > 0.6) {
      this.hpBar.setFillStyle(0x00FF00);
    } else if (percent > 0.3) {
      this.hpBar.setFillStyle(0xFFFF00);
    } else {
      this.hpBar.setFillStyle(0xFF0000);
    }
  }

  setOnFire() {
    if (!this.junkData.flammable || this.burning) return;

    this.burning = true;
    this.burnTimer = 0;

    // Create fire particles
    this.fireParticles = this.scene.add.particles(0, 0, 'particle', {
      speed: { min: 20, max: 40 },
      angle: { min: -100, max: -80 },
      scale: { start: 0.4, end: 0 },
      tint: [0xFF0000, 0xFF6600, 0xFFFF00],
      lifespan: 500,
      gravityY: -50,
      frequency: 50
    });

    this.add(this.fireParticles);
  }

  updateBurn(delta) {
    if (!this.burning) return false;

    this.burnTimer += delta;

    // Take damage every 100ms
    if (this.burnTimer >= 100) {
      const damaged = this.takeDamage(2);
      this.burnTimer = 0;
      return damaged;
    }

    return false;
  }

  explode() {
    // Will be handled by ExplosionSystem
    return {
      x: this.x,
      y: this.y,
      radius: 50,
      damage: 30
    };
  }

  destroy() {
    if (this.fireParticles) {
      this.fireParticles.destroy();
    }
    super.destroy();
  }
}
