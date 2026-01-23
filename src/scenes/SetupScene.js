import Phaser from 'phaser';
import { Player } from '../objects/Player.js';
import { Bomb } from '../objects/Bomb.js';
import { Junk } from '../objects/Junk.js';
import { getRandomJunk } from '../config/junkLibrary.js';
import { SETUP_TIME, PLAYER1_ZONE, PLAYER2_ZONE, BOMB_POSITIONS, GROUND_Y } from '../config/gameConfig.js';

export class SetupScene extends Phaser.Scene {
  constructor() {
    super({ key: 'SetupScene' });
  }

  create() {
    // Initialize players
    this.player1 = new Player(1, 'Player 1', 'left');
    this.player2 = new Player(2, 'Player 2', 'right');

    // Store in registry for other scenes
    this.registry.set('player1', this.player1);
    this.registry.set('player2', this.player2);

    // Create background
    this.createBackground();

    // Create bombs
    this.bomb1 = new Bomb(this, BOMB_POSITIONS.player1.x, BOMB_POSITIONS.player1.y, 'left');
    this.bomb2 = new Bomb(this, BOMB_POSITIONS.player2.x, BOMB_POSITIONS.player2.y, 'right');

    this.registry.set('bomb1', this.bomb1);
    this.registry.set('bomb2', this.bomb2);

    // Create junk groups
    this.junkGroup1 = this.add.group();
    this.junkGroup2 = this.add.group();

    // Generate random junk for each player
    this.player1.junkPieces = getRandomJunk();
    this.player2.junkPieces = getRandomJunk();

    // Create junk objects for Player 1
    this.player1.junkPieces.forEach((junkData, index) => {
      const x = PLAYER1_ZONE.min + 50 + (index % 5) * 55;
      const y = 150 + Math.floor(index / 5) * 80;
      const junk = new Junk(this, x, y, junkData);
      junk.setDraggable(true, PLAYER1_ZONE);
      this.junkGroup1.add(junk);
    });

    // Create junk objects for Player 2
    this.player2.junkPieces.forEach((junkData, index) => {
      const x = PLAYER2_ZONE.min + 50 + (index % 5) * 55;
      const y = 150 + Math.floor(index / 5) * 80;
      const junk = new Junk(this, x, y, junkData);
      junk.setDraggable(true, PLAYER2_ZONE);
      this.junkGroup2.add(junk);
    });

    this.registry.set('junkGroup1', this.junkGroup1);
    this.registry.set('junkGroup2', this.junkGroup2);

    // Timer
    this.timeRemaining = SETUP_TIME;
    this.timerText = this.add.text(400, 30, `Setup Time: ${this.timeRemaining}s`, {
      fontSize: '24px',
      fill: '#fff',
      stroke: '#000',
      strokeThickness: 4
    }).setOrigin(0.5);

    // Instructions
    this.instructionText = this.add.text(400, 70, 'Arrange your junk to protect your bomb!', {
      fontSize: '18px',
      fill: '#FFD700'
    }).setOrigin(0.5);

    // Start countdown
    this.timerEvent = this.time.addEvent({
      delay: 1000,
      callback: this.updateTimer,
      callbackScope: this,
      loop: true
    });
  }

  createBackground() {
    // Sky gradient
    const sky = this.add.rectangle(400, 250, 800, GROUND_Y, 0x87CEEB);

    // Ground
    const ground = this.add.rectangle(400, 550, 800, 100, 0x8B7355);

    // Dividing line
    const divider = this.add.line(0, 0, 400, 100, 400, GROUND_Y, 0xFFD700, 1);
    divider.setLineWidth(3);
    divider.setLineDash([10, 5]);

    // Zone labels
    this.add.text(200, 90, 'PLAYER 1 (RED)', {
      fontSize: '20px',
      fill: '#FF0000',
      stroke: '#000',
      strokeThickness: 3
    }).setOrigin(0.5);

    this.add.text(600, 90, 'PLAYER 2 (BLUE)', {
      fontSize: '20px',
      fill: '#0000FF',
      stroke: '#000',
      strokeThickness: 3
    }).setOrigin(0.5);
  }

  updateTimer() {
    this.timeRemaining--;
    this.timerText.setText(`Setup Time: ${this.timeRemaining}s`);

    if (this.timeRemaining <= 5) {
      this.timerText.setColor('#FF0000');
    }

    if (this.timeRemaining <= 0) {
      this.timerEvent.remove();
      this.startCombat();
    }
  }

  startCombat() {
    // Disable dragging
    this.junkGroup1.getChildren().forEach(junk => junk.setDraggable(false));
    this.junkGroup2.getChildren().forEach(junk => junk.setDraggable(false));

    // Transition to combat
    this.scene.start('CombatScene');
  }
}
