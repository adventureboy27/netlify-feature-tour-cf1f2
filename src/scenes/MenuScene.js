import Phaser from 'phaser';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    // Background
    const bg = this.add.rectangle(400, 300, 800, 600, 0x1a1a1a);

    // Title
    const title = this.add.text(400, 150, 'JUNKYARD BOMB\nDEFENSE WAR', {
      fontSize: '48px',
      fill: '#FF6600',
      stroke: '#000',
      strokeThickness: 6,
      align: 'center',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Subtitle
    const subtitle = this.add.text(400, 250, '2-Player Artillery Combat', {
      fontSize: '24px',
      fill: '#FFD700',
      align: 'center'
    }).setOrigin(0.5);

    // Instructions
    const instructions = this.add.text(400, 350,
      'Player 1 (Red) vs Player 2 (Blue)\n\n' +
      'Destroy your opponent\'s bomb core!\n' +
      'Protect yours with junk pieces.\n\n' +
      'Click to Start', {
      fontSize: '18px',
      fill: '#fff',
      align: 'center',
      lineSpacing: 8
    }).setOrigin(0.5);

    // Make it clickable
    this.input.on('pointerdown', () => {
      this.scene.start('SetupScene');
    });

    // Add flashing "Click to Start" effect
    this.tweens.add({
      targets: instructions,
      alpha: 0.3,
      duration: 800,
      yoyo: true,
      repeat: -1
    });
  }
}
