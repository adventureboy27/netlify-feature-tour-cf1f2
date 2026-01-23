import Phaser from 'phaser';
import { Projectile } from '../objects/Projectile.js';
import { PhysicsManager } from '../systems/PhysicsManager.js';
import { ExplosionSystem } from '../systems/ExplosionSystem.js';
import { FireSystem } from '../systems/FireSystem.js';
import { CollisionDetector } from '../utils/CollisionDetector.js';
import { ParticleEffects } from '../utils/ParticleEffects.js';
import { SHOTS_PER_TURN, REARRANGE_TIME, GROUND_Y } from '../config/gameConfig.js';

export class CombatScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CombatScene' });
  }

  create() {
    // Get data from registry
    this.player1 = this.registry.get('player1');
    this.player2 = this.registry.get('player2');
    this.bomb1 = this.registry.get('bomb1');
    this.bomb2 = this.registry.get('bomb2');
    this.junkGroup1 = this.registry.get('junkGroup1');
    this.junkGroup2 = this.registry.get('junkGroup2');

    // Add bombs and junk to this scene
    this.add.existing(this.bomb1);
    this.add.existing(this.bomb2);

    this.junkGroup1.getChildren().forEach(junk => this.add.existing(junk));
    this.junkGroup2.getChildren().forEach(junk => this.add.existing(junk));

    // Initialize systems
    this.physicsManager = new PhysicsManager(this);
    this.explosionSystem = new ExplosionSystem(this);
    this.fireSystem = new FireSystem(this);

    // Game state
    this.currentPlayer = this.player1;
    this.otherPlayer = this.player2;
    this.currentPlayerNum = 1;
    this.round = 1;
    this.projectile = null;
    this.isRearranging = false;

    // Controls state
    this.selectedWeapon = this.player1.weapons[0];
    this.angle = 45;
    this.power = 70;

    // Create background
    this.createBackground();

    // Create UI
    this.createUI();

    // Start first turn
    this.startTurn();
  }

  createBackground() {
    // Sky
    this.add.rectangle(400, 250, 800, GROUND_Y, 0x87CEEB);

    // Ground
    this.add.rectangle(400, 550, 800, 100, 0x8B7355);
    this.add.line(0, GROUND_Y, 0, 0, 800, 0, 0x654321).setOrigin(0).setLineWidth(3);

    // Dividing line
    const divider = this.add.line(0, 0, 400, 100, 400, GROUND_Y, 0xFFD700, 1);
    divider.setLineWidth(3);
    divider.setLineDash([10, 5]);
  }

  createUI() {
    // Header
    this.roundText = this.add.text(20, 20, `Round ${this.round}`, {
      fontSize: '20px',
      fill: '#fff',
      stroke: '#000',
      strokeThickness: 3
    });

    this.windText = this.add.text(400, 20, '', {
      fontSize: '18px',
      fill: '#fff',
      stroke: '#000',
      strokeThickness: 3
    }).setOrigin(0.5);

    this.coreText = this.add.text(780, 20, '', {
      fontSize: '16px',
      fill: '#fff',
      stroke: '#000',
      strokeThickness: 3
    }).setOrigin(1, 0);

    // Current player indicator
    this.playerText = this.add.text(400, 50, '', {
      fontSize: '22px',
      fill: '#FFD700',
      stroke: '#000',
      strokeThickness: 4
    }).setOrigin(0.5);

    // Weapon selection
    this.createWeaponUI();

    // Controls
    this.createControls();
  }

  createWeaponUI() {
    const startX = 20;
    const startY = 520;

    this.add.text(startX, startY - 25, 'WEAPONS:', {
      fontSize: '14px',
      fill: '#fff',
      stroke: '#000',
      strokeThickness: 2
    });

    this.weaponButtons = [];

    this.currentPlayer.weapons.forEach((weapon, index) => {
      const col = index % 4;
      const row = Math.floor(index / 4);
      const x = startX + col * 90;
      const y = startY + row * 35;

      const bg = this.add.rectangle(x, y, 85, 30, 0x333333);
      bg.setStrokeStyle(2, 0x666666);

      const text = this.add.text(x, y, `${weapon.emoji} ${weapon.name}\n${weapon.ammo === Infinity ? '∞' : weapon.ammo}`, {
        fontSize: '10px',
        fill: '#fff',
        align: 'center'
      }).setOrigin(0.5);

      const button = this.add.container(x, y, [bg, text]);
      button.setSize(85, 30);
      button.setInteractive();

      button.on('pointerdown', () => {
        if (weapon.ammo > 0 && !this.projectile) {
          this.selectWeapon(weapon);
        }
      });

      this.weaponButtons.push({ button, bg, text, weapon });
    });
  }

  createControls() {
    const startX = 400;
    const startY = 530;

    // Angle control
    this.add.text(startX, startY, 'Angle:', {
      fontSize: '14px',
      fill: '#fff',
      stroke: '#000',
      strokeThickness: 2
    });

    this.angleText = this.add.text(startX + 80, startY, `${this.angle}°`, {
      fontSize: '14px',
      fill: '#FFD700',
      stroke: '#000',
      strokeThickness: 2
    });

    // Angle slider (visual representation)
    this.angleSlider = this.add.rectangle(startX + 120, startY + 7, 100, 10, 0x666666);
    this.angleSliderHandle = this.add.circle(startX + 120, startY + 7, 8, 0xFFD700);
    this.angleSlider.setInteractive();
    this.angleSlider.on('pointerdown', (pointer) => {
      const localX = pointer.x - (startX + 120);
      const percent = Phaser.Math.Clamp((localX + 50) / 100, 0, 1);
      this.angle = Math.floor(10 + percent * 75);
      this.updateAngleSlider();
    });

    // Power control
    this.add.text(startX + 240, startY, 'Power:', {
      fontSize: '14px',
      fill: '#fff',
      stroke: '#000',
      strokeThickness: 2
    });

    this.powerText = this.add.text(startX + 320, startY, `${this.power}%`, {
      fontSize: '14px',
      fill: '#FFD700',
      stroke: '#000',
      strokeThickness: 2
    });

    // Power slider
    this.powerSlider = this.add.rectangle(startX + 360, startY + 7, 100, 10, 0x666666);
    this.powerSliderHandle = this.add.circle(startX + 360, startY + 7, 8, 0xFFD700);
    this.powerSlider.setInteractive();
    this.powerSlider.on('pointerdown', (pointer) => {
      const localX = pointer.x - (startX + 360);
      const percent = Phaser.Math.Clamp((localX + 50) / 100, 0, 1);
      this.power = Math.floor(20 + percent * 80);
      this.updatePowerSlider();
    });

    // Fire button
    this.fireButton = this.add.rectangle(startX + 500, startY + 7, 80, 30, 0xFF0000);
    this.fireButton.setStrokeStyle(2, 0x000000);
    this.fireButtonText = this.add.text(startX + 500, startY + 7, 'FIRE!', {
      fontSize: '16px',
      fill: '#fff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.fireButton.setInteractive();
    this.fireButton.on('pointerdown', () => this.fireWeapon());

    // Shots remaining
    this.shotsText = this.add.text(startX + 600, startY, '', {
      fontSize: '14px',
      fill: '#fff',
      stroke: '#000',
      strokeThickness: 2
    });

    this.updateAngleSlider();
    this.updatePowerSlider();
  }

  updateAngleSlider() {
    this.angleText.setText(`${this.angle}°`);
    const percent = (this.angle - 10) / 75;
    this.angleSliderHandle.x = 470 + percent * 100;
  }

  updatePowerSlider() {
    this.powerText.setText(`${this.power}%`);
    const percent = (this.power - 20) / 80;
    this.powerSliderHandle.x = 710 + percent * 100;
  }

  selectWeapon(weapon) {
    this.selectedWeapon = weapon;
    this.currentPlayer.selectWeapon(weapon.id);

    // Update visual feedback
    this.weaponButtons.forEach(({ bg, weapon: w }) => {
      if (w.id === weapon.id) {
        bg.setFillStyle(0x00FF00);
      } else {
        bg.setFillStyle(0x333333);
      }
    });
  }

  startTurn() {
    // Generate new wind
    const wind = this.physicsManager.generateWind();
    this.windText.setText(`Wind: ${wind > 0 ? '+' : ''}${wind} mph`);

    // Reset shots
    this.currentPlayer.resetShots(SHOTS_PER_TURN);

    // Update UI
    this.updateUI();
  }

  updateUI() {
    const playerColor = this.currentPlayerNum === 1 ? '#FF0000' : '#0000FF';
    this.playerText.setText(`${this.currentPlayer.name}'s Turn`);
    this.playerText.setFill(playerColor);

    this.shotsText.setText(`Shots: ${this.currentPlayer.shotsRemaining}/${SHOTS_PER_TURN}`);

    this.coreText.setText(`P1: ${this.bomb1.coreHP} | P2: ${this.bomb2.coreHP}`);

    // Update weapon buttons with current player's weapons
    this.weaponButtons.forEach(({ text, weapon }) => {
      const currentWeapon = this.currentPlayer.getWeaponById(weapon.id);
      text.setText(`${weapon.emoji} ${weapon.name}\n${currentWeapon.ammo === Infinity ? '∞' : currentWeapon.ammo}`);
    });
  }

  fireWeapon() {
    if (this.projectile || this.selectedWeapon.ammo <= 0 || this.currentPlayer.shotsRemaining <= 0) {
      return;
    }

    // Determine shooter position
    const shooterX = this.currentPlayerNum === 1 ? 100 : 700;
    const shooterY = GROUND_Y - 10;

    // Create projectile
    const wind = this.physicsManager.getWind();

    // Handle shotgun spread
    if (this.selectedWeapon.spread) {
      for (let i = 0; i < this.selectedWeapon.spread; i++) {
        const spreadAngle = this.angle + (i - 1) * 5;
        const proj = new Projectile(this, shooterX, shooterY, this.selectedWeapon, spreadAngle, this.power, wind);
        this.time.delayedCall(50 * i, () => {
          if (!this.projectile) {
            this.projectile = proj;
          }
        });
      }
    } else {
      this.projectile = new Projectile(this, shooterX, shooterY, this.selectedWeapon, this.angle, this.power, wind);
    }

    // Use ammo
    this.currentPlayer.useAmmo();
    this.updateUI();
  }

  update(time, delta) {
    // Update projectile
    if (this.projectile && this.projectile.active) {
      this.projectile.update();

      // Check collisions
      const collision = CollisionDetector.checkProjectileCollisions(
        this,
        this.projectile,
        this.currentPlayerNum === 1 ? this.junkGroup2 : this.junkGroup1,
        [this.currentPlayerNum === 1 ? this.bomb2 : this.bomb1]
      );

      if (collision) {
        this.handleCollision(collision);
      }
    }

    // Update fire system
    const destroyed = this.fireSystem.update(delta, [this.junkGroup1, this.junkGroup2]);
    if (destroyed.length > 0) {
      this.handleDestroyedJunk(destroyed);
    }

    // Update bomb visuals
    this.bomb1.draw();
    this.bomb2.draw();
  }

  handleCollision(collision) {
    const { type, target, x, y } = collision;

    this.projectile.deactivate();

    if (type === 'junk') {
      // Damage junk
      const destroyed = target.takeDamage(this.selectedWeapon.damage);

      ParticleEffects.createImpactEffect(this, x, y);

      if (destroyed) {
        this.handleDestroyedJunk([target]);
      }

      // Handle fire weapons
      if (this.selectedWeapon.fire) {
        this.fireSystem.ignite(x, y, [this.junkGroup1, this.junkGroup2]);
      }

      // Handle explosive weapons
      if (this.selectedWeapon.explosive) {
        const destroyed = this.explosionSystem.explode(
          x, y,
          this.selectedWeapon.radius,
          this.selectedWeapon.damage,
          [this.junkGroup1, this.junkGroup2],
          [this.bomb1, this.bomb2]
        );

        if (destroyed.length > 0) {
          this.handleDestroyedJunk(destroyed);
        }
      }
    } else if (type === 'bomb') {
      // Damage bomb
      const result = target.takeDamage(x, y, this.selectedWeapon.damage);

      if (result) {
        ParticleEffects.createImpactEffect(this, x, y);
      }

      // Handle fire weapons
      if (this.selectedWeapon.fire) {
        this.fireSystem.ignite(x, y, [this.junkGroup1, this.junkGroup2]);
      }

      // Handle explosive weapons
      if (this.selectedWeapon.explosive) {
        const destroyed = this.explosionSystem.explode(
          x, y,
          this.selectedWeapon.radius,
          this.selectedWeapon.damage,
          [this.junkGroup1, this.junkGroup2],
          [this.bomb1, this.bomb2]
        );

        if (destroyed.length > 0) {
          this.handleDestroyedJunk(destroyed);
        }
      }

      // Check if bomb is destroyed
      if (target.isDestroyed()) {
        this.endGame();
        return;
      }
    } else if (type === 'ground') {
      ParticleEffects.createImpactEffect(this, x, y);

      // Handle fire weapons
      if (this.selectedWeapon.fire) {
        this.fireSystem.ignite(x, y, [this.junkGroup1, this.junkGroup2]);
      }

      // Handle explosive weapons
      if (this.selectedWeapon.explosive) {
        const destroyed = this.explosionSystem.explode(
          x, y,
          this.selectedWeapon.radius,
          this.selectedWeapon.damage,
          [this.junkGroup1, this.junkGroup2],
          [this.bomb1, this.bomb2]
        );

        if (destroyed.length > 0) {
          this.handleDestroyedJunk(destroyed);
        }
      }
    }

    // Clear projectile after a short delay
    this.time.delayedCall(100, () => {
      if (this.projectile) {
        this.projectile.destroy();
        this.projectile = null;

        // Check if turn is over
        if (this.currentPlayer.shotsRemaining <= 0) {
          this.time.delayedCall(500, () => this.endTurn());
        }
      }
    });
  }

  handleDestroyedJunk(destroyedJunk) {
    destroyedJunk.forEach(junk => {
      // Handle chain reactions
      const reactions = this.explosionSystem.handleChainReactions(
        [junk],
        [this.junkGroup1, this.junkGroup2],
        [this.bomb1, this.bomb2]
      );

      // Process further destroyed junk
      if (reactions.furtherDestroyed.length > 0) {
        this.time.delayedCall(200, () => {
          this.handleDestroyedJunk(reactions.furtherDestroyed);
        });
      }

      // Remove junk
      junk.destroy();
    });
  }

  endTurn() {
    // Switch players
    if (this.currentPlayerNum === 1) {
      this.currentPlayer = this.player2;
      this.otherPlayer = this.player1;
      this.currentPlayerNum = 2;
    } else {
      this.currentPlayer = this.player1;
      this.otherPlayer = this.player2;
      this.currentPlayerNum = 1;
      this.round++;
      this.roundText.setText(`Round ${this.round}`);

      // After both players have gone, allow rearranging
      this.startRearrangePhase();
      return;
    }

    this.startTurn();
  }

  startRearrangePhase() {
    this.isRearranging = true;

    // Enable dragging
    this.junkGroup1.getChildren().forEach(junk => {
      junk.setDraggable(true, { min: 50, max: 350 });
    });
    this.junkGroup2.getChildren().forEach(junk => {
      junk.setDraggable(true, { min: 450, max: 750 });
    });

    // Show timer
    let timeRemaining = REARRANGE_TIME;
    const timerText = this.add.text(400, 300, `Rearrange Phase: ${timeRemaining}s`, {
      fontSize: '32px',
      fill: '#FFD700',
      stroke: '#000',
      strokeThickness: 6
    }).setOrigin(0.5);

    const timerEvent = this.time.addEvent({
      delay: 1000,
      callback: () => {
        timeRemaining--;
        timerText.setText(`Rearrange Phase: ${timeRemaining}s`);

        if (timeRemaining <= 0) {
          timerEvent.remove();
          timerText.destroy();

          // Disable dragging
          this.junkGroup1.getChildren().forEach(junk => junk.setDraggable(false));
          this.junkGroup2.getChildren().forEach(junk => junk.setDraggable(false));

          this.isRearranging = false;
          this.startTurn();
        }
      },
      loop: true
    });
  }

  endGame() {
    // Determine winner
    const winner = this.bomb1.isDestroyed() ? this.player2 : this.player1;

    // Create massive explosion
    const destroyedBomb = this.bomb1.isDestroyed() ? this.bomb1 : this.bomb2;
    ParticleEffects.createBombExplosion(this, destroyedBomb.x, destroyedBomb.y);

    // Transition to game over scene
    this.time.delayedCall(1500, () => {
      this.scene.start('GameOverScene', { winner: winner.name, winnerNum: winner.id });
    });
  }
}
